<script setup lang="ts">
// Every IANA zone, grouped by region, labelled with its current UTC offset.
import { computed } from 'vue'
import { groupedZones } from '../lib/zones.ts'

const model = defineModel<string>({ required: true })
const props = defineProps<{
  /** Zones to include even if the browser's list lacks them (e.g. the event's own). */
  extra?: readonly string[]
}>()

const groups = computed(() => groupedZones([model.value, ...(props.extra ?? [])]))
</script>

<template>
  <select v-model="model" class="select">
    <optgroup v-for="group in groups" :key="group.region" :label="group.region">
      <option v-for="zone in group.zones" :key="zone.value" :value="zone.value">{{ zone.label }}</option>
    </optgroup>
  </select>
</template>
