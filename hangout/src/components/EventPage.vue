<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError, api, forgetSession, loadSession, saveSession } from '../api.ts'
import type { EventView, Session } from '../api.ts'
import { buildGrid } from '../lib/grid.ts'
import { LatestOnlySaver } from '../lib/latest-only-saver.ts'
import type { SaveStatus } from '../lib/latest-only-saver.ts'
import { normalizeTimeZone } from '../lib/zoned-time.ts'
import { browserTimeZone, zoneLabel } from '../lib/zones.ts'
import AvailabilityGrid from './AvailabilityGrid.vue'
import TimeZoneSelect from './TimeZoneSelect.vue'

const props = defineProps<{ eventId: string }>()

// ---------- The event ----------

const event = ref<EventView | null>(null)
const loadError = ref<'not-found' | 'failed' | null>(null)

async function load(): Promise<void> {
  try {
    event.value = await api.getEvent(props.eventId)
    loadError.value = null
  } catch (error) {
    // Keep showing what we have if a background refresh fails.
    if (!event.value) loadError.value = error instanceof ApiError && error.status === 404 ? 'not-found' : 'failed'
  }
}

watch(() => event.value?.title, (title) => {
  document.title = title ? `${title} – hangout` : 'hangout'
})

// ---------- Viewer's timezone (remembered across events) ----------

const ZONE_KEY = 'hangout:viewerZone'
const myZone = browserTimeZone()

function initialViewerZone(): string {
  try {
    const saved = localStorage.getItem(ZONE_KEY)
    const zone = saved ? normalizeTimeZone(saved) : null
    if (zone) return zone
  } catch {
    // Storage unavailable: fall through to the browser's zone.
  }
  return myZone
}

const viewerZone = ref(initialViewerZone())
watch(viewerZone, (zone) => {
  try {
    localStorage.setItem(ZONE_KEY, zone)
  } catch {
    // Not remembering the choice is fine.
  }
})

// ---------- Grid model, shared by both grids ----------

const grid = computed(() => {
  const e = event.value
  if (!e) return null
  return buildGrid(
    e.slots.map((s) => s.start),
    viewerZone.value,
    e.slotMinutes,
    { weekdaysOnly: e.mode === 'weekdays' },
  )
})
const summaries = computed(() => new Map((event.value?.slots ?? []).map((s) => [s.start, s])))
const total = computed(() => event.value?.participants.length ?? 0)

// ---------- Sign-in and your selection ----------

const session = ref<Session | null>(loadSession(props.eventId))
const mySlots = ref<Set<string>>(new Set())
const name = ref('')
const signingIn = ref(false)
const signInError = ref<string | null>(null)

async function signIn(): Promise<void> {
  signInError.value = null
  const trimmed = name.value.trim()
  if (!trimmed) {
    signInError.value = 'Enter your name.'
    return
  }
  signingIn.value = true
  try {
    const s = await api.join(props.eventId, trimmed )
    session.value = s
    saveSession(props.eventId, s)
    mySlots.value = new Set(s.slots)
    await load() // so your name appears in the group count
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      signInError.value =
        error instanceof ApiError ? error.message : "Couldn't reach the server. Check your connection and try again."
    }
  } finally {
    signingIn.value = false
  }
}

function signOut(): void {
  session.value = null
  mySlots.value = new Set()
  forgetSession(props.eventId)
}

async function removeMe(): Promise<void> {
  const s = session.value
  if (!s || !window.confirm(`Remove ${s.name}'s times from this event?`)) return
  try {
    await api.removeMe(props.eventId, s)
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      saveError.value = "Couldn't remove your times. Check your connection and try again."
      return
    }
  }
  signOut()
  await load()
}

// ---------- Saving (after every drag) ----------

const saveStatus = ref<SaveStatus>('idle')
const saveError = ref<string | null>(null)

const saver = new LatestOnlySaver<{ session: Session; slots: string[] }, EventView>(
  ({ session: s, slots }) => api.saveAvailability(props.eventId, s, slots),
  {
    onResult: (view) => {
      event.value = view
      saveError.value = null
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        signOut()
        signInError.value = 'Your sign-in for this event is no longer valid. Sign in again to keep editing.'
      } else {
        saveError.value = "Couldn't save your times. Check your connection and try again."
      }
    },
    onStatus: (status) => {
      saveStatus.value = status
    },
  },
)

function onChange(next: Set<string>): void {
  mySlots.value = next
  if (session.value) saver.submit({ session: session.value, slots: [...next].sort() })
}

const saveMessage = computed(() => {
  if (saveStatus.value === 'saving') return 'Saving…'
  if (saveStatus.value === 'saved') return 'Saved'
  return ''
})

// ---------- Hover: who's free at a slot ----------

const hovered = ref<string | null>(null)
const canHover = window.matchMedia?.('(hover: hover)').matches ?? true

const hoveredSlot = computed(() => {
  const start = hovered.value
  const e = event.value
  if (!start || !e) return null
  const summary = summaries.value.get(start)
  if (!summary) return null
  const free = new Set(summary.names)
  return {
    description: grid.value?.cellByStart.get(start)?.description ?? '',
    free: summary.names,
    busy: e.participants.filter((n) => !free.has(n)),
  }
})

// ---------- Share link ----------

const shareUrl = computed(() => `${window.location.origin}/e/${props.eventId}`)
const shareInput = ref<HTMLInputElement | null>(null)
const copied = ref(false)
let copiedTimer = 0

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard blocked (e.g. a plain-http address): select the link so it can be copied by hand.
    shareInput.value?.select()
  }
}

// ---------- Lifecycle ----------

let refreshTimer = 0

onMounted(async () => {
  await load()
  // Restore a remembered sign-in, rebuilding the selection from fresh event data.
  const s = session.value
  const e = event.value
  if (s && e) {
    if (e.participants.includes(s.name)) {
      mySlots.value = new Set(e.slots.filter((slot) => slot.names.includes(s.name)).map((slot) => slot.start))
    } else {
      signOut()
    }
  }
  // Pick up other people's changes. Real-time sockets come in milestone 2.
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && !saver.busy) void load()
  }, 10_000)
})

onBeforeUnmount(() => {
  window.clearInterval(refreshTimer)
  window.clearTimeout(copiedTimer)
})
</script>

<template>
  <main>
    <div v-if="loadError === 'not-found'" class="event-head">
      <h1 class="headline">This event doesn't exist.</h1>
      <p class="lede">Check that the link was copied in full, or <a href="/">create a new event</a>.</p>
    </div>
    <p v-else-if="loadError" class="error" role="alert">Couldn't load this event. Check your connection and reload.</p>
    <p v-else-if="!event || !grid" class="muted">Loading event…</p>

    <template v-else>
      <header class="event-head">
        <h1 class="headline">{{ event.title }}</h1>
        <p v-if="event.description" class="lede">{{ event.description }}</p>
        <div class="share">
          <label class="field__label" for="share-link">Share this link with your group</label>
          <div class="share__row">
            <input id="share-link" ref="shareInput" class="input" readonly :value="shareUrl" @focus="shareInput?.select()" />
            <button class="btn btn--quiet" type="button" @click="copyLink">{{ copied ? 'Copied' : 'Copy link' }}</button>
          </div>
        </div>
      </header>

      <section class="zone-bar" aria-label="Time zone">
        <label class="field__label" for="viewer-zone">Showing times in</label>
        <TimeZoneSelect id="viewer-zone" v-model="viewerZone" :extra="[event.timeZone, myZone]" />
        <button v-if="viewerZone !== myZone" class="link-btn" type="button" @click="viewerZone = myZone">
          Use my time zone
        </button>
        <p v-if="viewerZone !== event.timeZone" class="zone-bar__note">
          This event was set up in {{ zoneLabel(event.timeZone) }}. Every time here is converted to the zone you pick.
        </p>
      </section>

      <div class="boards">
        <section class="board" aria-labelledby="mine-title">
          <h2 id="mine-title" class="section-title">Your availability</h2>

          <form v-if="!session" class="sign-in" novalidate @submit.prevent="signIn">
            <p class="board__hint">Enter your name to mark when you're free. No account needed.</p>
            <div class="field">
              <label class="field__label" for="your-name">Your name</label>
              <input id="your-name" v-model="name" class="input" maxlength="80" autocomplete="name" />
            </div>
            <p v-if="signInError" class="error" role="alert">{{ signInError }}</p>
            <button class="btn" type="submit" :disabled="signingIn">{{ signingIn ? 'Signing in…' : 'Sign in' }}</button>
          </form>

          <template v-else>
            <p class="board__hint">
              Signed in as <strong>{{ session.name }}</strong>. Click and drag to mark when you're free; drag over
              marked times to clear them.
            </p>
            <AvailabilityGrid
              :grid="grid"
              mode="mine"
              :slot-minutes="event.slotMinutes"
              label="Your availability"
              :selected="mySlots"
              :hovered="hovered"
              @change="onChange"
              @hover="hovered = $event"
            />
            <p class="save-status" aria-live="polite">
              <span v-if="saveError" class="error">
                {{ saveError }}
                <button class="link-btn" type="button" @click="onChange(mySlots)">Try again</button>
              </span>
              <template v-else>{{ saveMessage }}</template>
            </p>
            <div class="board__actions">
              <button class="link-btn" type="button" @click="signOut">Not {{ session.name }}?</button>
              <button class="link-btn link-btn--danger" type="button" @click="removeMe">Remove my times</button>
            </div>
          </template>
        </section>

        <section class="board" aria-labelledby="group-title">
          <h2 id="group-title" class="section-title">Everyone's availability</h2>
          <p v-if="total === 0" class="board__hint">Nobody has added their times yet. Share the link to get started.</p>
          <div v-else class="legend">
            <span>0 of {{ total }} free</span>
            <span class="legend__ramp" aria-hidden="true">
              <span v-for="step in 5" :key="step" :style="{ '--level': String((step - 1) / 4) }"></span>
            </span>
            <span>{{ total }} of {{ total }} free</span>
          </div>
          <AvailabilityGrid
            :grid="grid"
            mode="group"
            :slot-minutes="event.slotMinutes"
            label="Everyone's availability"
            :summaries="summaries"
            :total="total"
            :hovered="hovered"
            @hover="hovered = $event"
          />
          <aside v-if="total > 0" class="who" aria-live="polite">
            <template v-if="hoveredSlot">
              <p class="who__time">{{ hoveredSlot.description }}</p>
              <p class="who__list">
                <strong>Free ({{ hoveredSlot.free.length }}):</strong>
                {{ hoveredSlot.free.length ? hoveredSlot.free.join(', ') : 'nobody' }}
              </p>
              <p v-if="hoveredSlot.busy.length" class="who__list muted">
                Not free ({{ hoveredSlot.busy.length }}): {{ hoveredSlot.busy.join(', ') }}
              </p>
            </template>
            <p v-else class="muted">{{ canHover ? 'Hover over' : 'Tap' }} a time to see who's free.</p>
          </aside>
        </section>
      </div>
    </template>
  </main>
</template>
