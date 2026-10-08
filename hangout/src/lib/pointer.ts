// Pointer wiring for the grid. Works the same for mouse, pen and touch.
//
// Why not just listen for pointerenter on each cell? On touch, the browser
// keeps sending every pointer event to the cell where the finger went down
// (implicit pointer capture), so other cells never hear about the finger.
// Instead we ask document.elementFromPoint which cell is under the pointer.
// The grid also needs `touch-action: none` in CSS, or the browser scrolls the
// page instead of letting you drag.

import type { CellPos } from './drag-selection.ts'

export interface DragHandlers {
  start(pos: CellPos): void
  move(pos: CellPos): void
  end(): void
  cancel(): void
}

function cellPosOf(target: EventTarget | Element | null, grid: HTMLElement): CellPos | null {
  if (!(target instanceof Element)) return null
  const cell = target.closest<HTMLElement>('[data-col][data-row]')
  if (!cell || !grid.contains(cell)) return null
  return { col: Number(cell.dataset.col), row: Number(cell.dataset.row) }
}

/** Calls `handlers` as a drag moves across the cells of `grid`. Returns a function that detaches everything. */
export function attachDragHandlers(grid: HTMLElement, handlers: DragHandlers): () => void {
  let pointerId: number | null = null

  const stopListening = () => {
    pointerId = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    const pos = cellPosOf(document.elementFromPoint(e.clientX, e.clientY), grid)
    if (pos) handlers.move(pos) // outside the grid: keep the last cell
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    stopListening()
    handlers.end()
  }
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    stopListening()
    handlers.cancel()
  }
  const onDown = (e: PointerEvent) => {
    if (pointerId !== null || e.button !== 0) return // a second finger, or not the main button
    const pos = cellPosOf(e.target, grid)
    if (!pos) return
    e.preventDefault() // no text selection, no emulated mouse events
    pointerId = e.pointerId
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    handlers.start(pos)
  }

  grid.addEventListener('pointerdown', onDown)
  return () => {
    grid.removeEventListener('pointerdown', onDown)
    if (pointerId !== null) {
      stopListening()
      handlers.cancel()
    }
  }
}

/**
 * Reports which cell the pointer is over (null when it leaves the grid). On
 * touch there is no hover, so a tap reports its cell and it stays reported
 * after the finger lifts, letting people tap a slot to see who's free.
 */
export function attachHover(grid: HTMLElement, onHover: (pos: CellPos | null) => void): () => void {
  const onOver = (e: PointerEvent) => {
    const pos = cellPosOf(e.target, grid)
    if (pos || e.pointerType !== 'touch') onHover(pos)
  }
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') onHover(null)
  }
  grid.addEventListener('pointerover', onOver)
  grid.addEventListener('pointerleave', onLeave)
  return () => {
    grid.removeEventListener('pointerover', onOver)
    grid.removeEventListener('pointerleave', onLeave)
  }
}
