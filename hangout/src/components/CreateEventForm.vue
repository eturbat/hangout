<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError, api } from '../api.ts'
import { addDays, datesBetween, hourLabel, todayIso } from '../lib/calendar.ts'
import { browserTimeZone } from '../lib/zones.ts'
import TimeZoneSelect from './TimeZoneSelect.vue'

const emit = defineEmits<{ created: [eventId: string] }>()

const MAX_DAYS = 31
const today = todayIso()

const title = ref('')
const description = ref('')
const fromDate = ref(today)
const toDate = ref(addDays(today, 6))
const startHour = ref(9)
const endHour = ref(17)
const timeZone = ref(browserTimeZone())
const slotMinutes = ref(30)

const attempted = ref(false)
const creating = ref(false)
const serverError = ref<string | null>(null)

const startHours = Array.from({ length: 24 }, (_, h) => h)
const endHours = Array.from({ length: 24 }, (_, h) => h + 1)
const slotSizes = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
]

const dates = computed(() => datesBetween(fromDate.value, toDate.value, MAX_DAYS + 1))
const dayCount = computed(() => {
  const n = dates.value.length
  if (n === 0 || n > MAX_DAYS) return ''
  return n === 1 ? '1 day' : `${n} days`
})

const problem = computed(() => {
  if (!title.value.trim()) return 'Give the event a name.'
  if (dates.value.length === 0) return 'The last date has to be on or after the first date.'
  if (dates.value.length > MAX_DAYS) return `Pick ${MAX_DAYS} days or fewer.`
  if (endHour.value <= startHour.value) return 'The latest time has to be after the earliest time.'
  return null
})

async function create() {
  attempted.value = true
  serverError.value = null
  if (problem.value) return
  creating.value = true
  try {
    const { id } = await api.createEvent({
      title: title.value.trim(),
      description: description.value.trim(),
      dates: dates.value,
      timeZone: timeZone.value,
      dayStartMinutes: startHour.value * 60,
      dayEndMinutes: endHour.value * 60,
      slotMinutes: slotMinutes.value as 15 | 30 | 60,
    })
    emit('created', id)
  } catch (error) {
    serverError.value =
      error instanceof ApiError ? error.message : "Couldn't reach the server. Check your connection and try again."
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <main class="create">
    <h1 class="headline">Find a time that works in every time zone.</h1>
    <p class="lede">
      Everyone marks when they're free in their own local time. hangout lines it all up and shows where the
      group overlaps.
    </p>

    <form class="create__form" novalidate @submit.prevent="create">
      <div class="field">
        <label class="field__label" for="title">Event name</label>
        <input id="title" v-model="title" class="input" maxlength="200" autocomplete="off" placeholder="Study call" />
      </div>

      <div class="field">
        <label class="field__label" for="description">Details <span class="muted">(optional)</span></label>
        <input
          id="description"
          v-model="description"
          class="input"
          maxlength="2000"
          autocomplete="off"
          placeholder="Agenda, a meeting link, anything people should know"
        />
      </div>

      <fieldset class="field fieldset">
        <legend class="field__label">Dates</legend>
        <div class="pair">
          <div class="field">
            <label class="field__hint" for="from-date">First day</label>
            <input id="from-date" v-model="fromDate" class="input" type="date" />
          </div>
          <div class="field">
            <label class="field__hint" for="to-date">Last day</label>
            <input id="to-date" v-model="toDate" class="input" type="date" :min="fromDate" />
          </div>
        </div>
        <p v-if="dayCount" class="field__hint">{{ dayCount }}</p>
      </fieldset>

      <fieldset class="field fieldset">
        <legend class="field__label">Times</legend>
        <div class="pair">
          <div class="field">
            <label class="field__hint" for="start-hour">No earlier than</label>
            <select id="start-hour" v-model.number="startHour" class="select">
              <option v-for="h in startHours" :key="h" :value="h">{{ hourLabel(h) }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__hint" for="end-hour">No later than</label>
            <select id="end-hour" v-model.number="endHour" class="select">
              <option v-for="h in endHours" :key="h" :value="h">{{ hourLabel(h) }}</option>
            </select>
          </div>
        </div>
      </fieldset>

      <div class="pair">
        <div class="field">
          <label class="field__label" for="event-zone">Time zone</label>
          <TimeZoneSelect id="event-zone" v-model="timeZone" />
          <p class="field__hint">The dates and times above are in this zone.</p>
        </div>
        <div class="field">
          <label class="field__label" for="slot-size">Slot length</label>
          <select id="slot-size" v-model.number="slotMinutes" class="select">
            <option v-for="size in slotSizes" :key="size.value" :value="size.value">{{ size.label }}</option>
          </select>
        </div>
      </div>

      <p v-if="attempted && problem" class="error" role="alert">{{ problem }}</p>
      <p v-else-if="serverError" class="error" role="alert">{{ serverError }}</p>

      <button class="btn" type="submit" :disabled="creating">{{ creating ? 'Creating event…' : 'Create event' }}</button>
    </form>
  </main>
</template>
