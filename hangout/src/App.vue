<script setup lang="ts">
// Two pages, so a tiny router instead of vue-router:
//   /         create an event
//   /e/<id>   an event
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import CreateEventForm from './components/CreateEventForm.vue'
import EventPage from './components/EventPage.vue'

const path = ref(window.location.pathname)
const eventId = computed(() => /^\/e\/([0-9a-f-]{36})\/?$/i.exec(path.value)?.[1] ?? null)

function go(to: string): void {
  window.history.pushState(null, '', to)
  path.value = to
  window.scrollTo(0, 0)
}

const onPopState = () => {
  path.value = window.location.pathname
}
onMounted(() => window.addEventListener('popstate', onPopState))
onBeforeUnmount(() => window.removeEventListener('popstate', onPopState))
</script>

<template>
  <div class="app">
    <header class="masthead">
      <a class="wordmark" href="/" @click.prevent="go('/')">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="2" y="2" width="13" height="13" rx="3" fill="#24204a" />
          <rect x="17" y="2" width="13" height="13" rx="3" fill="#24204a" opacity=".3" />
          <rect x="2" y="17" width="13" height="13" rx="3" fill="#24204a" opacity=".3" />
          <rect x="17" y="17" width="13" height="13" rx="3" fill="#f4a51c" />
        </svg>
        hangout
      </a>
    </header>
    <EventPage v-if="eventId" :key="eventId" :event-id="eventId" />
    <CreateEventForm v-else @created="(id) => go(`/e/${id}`)" />
  </div>
</template>
