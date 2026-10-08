<script setup lang="ts">
// One grid, two modes:
//  - "mine": click and drag to mark when you're free (emits `change` on release)
//  - "group": heatmap of how many people are free in each slot
// Layout comes from buildGrid (lib/grid.ts); selection logic from DragSelection.
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { SlotSummary } from '../api.ts'
import { DragSelection } from '../lib/drag-selection.ts'
import type { CellPos } from '../lib/drag-selection.ts'
import type { GridCell, GridModel } from '../lib/grid.ts'
import { attachDragHandlers, attachHover } from '../lib/pointer.ts'

const props = defineProps<{
  grid: GridModel
  mode: 'mine' | 'group'
  slotMinutes: number
  /** Accessible name for the grid. */
  label: string
  /** mine: the saved selection, as slot start strings. */
  selected?: ReadonlySet<string>
  /** group: who is free in each slot, by slot start. */
  summaries?: ReadonlyMap<string, SlotSummary>
  /** group: how many people have responded. */
  total?: number
  /** Slot start to outline, so hovering one grid highlights the same slot in the other. */
  hovered?: string | null
}>()

const emit = defineEmits<{
  change: [selected: Set<string>]
  hover: [start: string | null]
}>()

const NOTHING: ReadonlySet<string> = new Set()
const root = ref<HTMLElement | null>(null)
const drag = reactive(new DragSelection())
const cleanups: (() => void)[] = []

const cellAt = (pos: CellPos): GridCell | null => {
	props.grid.cells[pos.row]?.[pos.col] ?? null
}
const selection = () => props.selected ?? NOTHING

onMounted(() => {
  const el = root.value
  if (!el) return
	cleanups.push(attachHover(el, (pos) => {
		emit('hover', pos ? (cellAt(pos)?.start ?? null) : null)
	}))
  if (props.mode === 'mine') {
    cleanups.push(
      attachDragHandlers(el, {
        start: (pos) => drag.begin(pos, selection().has(cellAt(pos)?.start ?? '')),
        move: (pos) => drag.move(pos),
        end: () => emit('change', drag.end(props.grid.cells, selection())),
        cancel: () => drag.cancel(),
      }),
    )
  }
})
onBeforeUnmount(() => cleanups.forEach((cleanup) => cleanup()))

const gridStyle = computed(() => ({
  gridTemplateColumns: `max-content repeat(${props.grid.columns.length}, minmax(2.25rem, 4.5rem))`,
  '--cell-height': props.slotMinutes >= 60 ? '1.75rem' : props.slotMinutes >= 30 ? '1.25rem' : '1rem',
}))

const countOf = (cell: GridCell) => props.summaries?.get(cell.start)?.count ?? 0
const isOn = (cell: GridCell) => drag.isSelected(cell, selection().has(cell.start))
const everyoneFree = (cell: GridCell) => (props.total ?? 0) > 0 && countOf(cell) === props.total

/** Border classes, shared by real cells and the hatched "no slot here" cells. */
function edges(r: number, c: number) {
  const next = props.grid.rows[r + 1]
  return {
    'cell--first-col': c === 0,
    'cell--top': r === 0,
    'cell--hour-end': !next || next.label !== null || next.gapBefore,
    'gap-before': props.grid.rows[r]?.gapBefore ?? false,
  }
}

function cellClasses(cell: GridCell, r: number, c: number) {
  return {
    ...edges(r, c),
    'cell--on': props.mode === 'mine' && isOn(cell),
    'cell--everyone': props.mode === 'group' && everyoneFree(cell),
    'cell--hover': props.hovered === cell.start,
  }
}

function cellStyle(cell: GridCell) {
  if (props.mode !== 'group' || !props.total) return undefined
  return { '--level': String(countOf(cell) / props.total) }
}

function ariaLabel(cell: GridCell): string {
  if (props.mode === 'group') return `${cell.description}: ${countOf(cell)} of ${props.total ?? 0} free`
  return cell.description
}
</script>

<template>
  <div class="grid-scroll">
    <div
      ref="root"
      class="grid"
      :class="`grid--${mode}`"
      :style="gridStyle"
      role="grid"
      :aria-label="label"
      :aria-multiselectable="mode === 'mine' ? 'true' : undefined"
    >
      <div class="grid__row" role="row">
        <div aria-hidden="true"></div>
        <div v-for="column in grid.columns" :key="column.date" class="grid__day" role="columnheader">
          <span class="grid__weekday">{{ column.weekday }}</span>
          <span v-if="column.dayLabel" class="grid__date">{{ column.dayLabel }}</span>
        </div>
      </div>

      <div v-for="(row, r) in grid.rows" :key="row.key" class="grid__row" role="row">
        <div class="grid__time" :class="{ 'gap-before': row.gapBefore }" role="rowheader">{{ row.label }}</div>
        <template v-for="(cell, c) in grid.cells[r] ?? []" :key="c">
          <div
            v-if="cell"
            class="cell"
            :class="cellClasses(cell, r, c)"
            :style="cellStyle(cell)"
            :data-col="c"
            :data-row="r"
            role="gridcell"
            :aria-label="ariaLabel(cell)"
            :aria-selected="mode === 'mine' ? isOn(cell) : undefined"
          >
            <span v-if="mode === 'group' && countOf(cell) > 0" class="cell__count" aria-hidden="true">
              {{ countOf(cell) }}
            </span>
          </div>
          <div v-else class="cell cell--none" :class="edges(r, c)" role="gridcell" aria-disabled="true"></div>
        </template>
      </div>
    </div>
  </div>
</template>
