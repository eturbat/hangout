// The click-and-drag selection model, mirroring when2meet: dragging paints a
// rectangle from the cell you pressed to the cell under the pointer. If the
// first cell was free you're adding; if it was already marked you're erasing.
// Pure state, no DOM, so it's unit tested in drag-selection.test.ts.

import type { GridCell } from './grid.ts'

export interface CellPos {
  col: number
  row: number
}

export class DragSelection {
  private anchor: CellPos | null = null
  private current: CellPos | null = null
  private adding = true

  get active(): boolean {
    return this.anchor !== null
  }

  begin(pos: CellPos, startsSelected: boolean): void {
    this.anchor = pos
    this.current = pos
    this.adding = !startsSelected
  }

  move(pos: CellPos): void {
    if (!this.anchor || !this.current) return
    if (pos.col !== this.current.col || pos.row !== this.current.row) this.current = pos
  }

  /** How a cell should look right now: inside the drag rectangle it previews the drag. */
  isSelected(pos: CellPos, committed: boolean): boolean {
    return this.covers(pos) ? this.adding : committed
  }

  /** Finishes the drag and returns the new selection */
  end(cells: readonly (readonly (GridCell | null)[])[], committed: ReadonlySet<string>): Set<string> {
    const next = new Set(committed)
    if (this.anchor && this.current) {
      const [top, bottom] = span(this.anchor.row, this.current.row)
      const [left, right] = span(this.anchor.col, this.current.col)
      for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
          const cell = cells[row]?.[col]
          if (!cell) continue
          if (this.adding) next.add(cell.start)
          else next.delete(cell.start)
        }
      }
    }
    this.cancel()
    return next
  }

  cancel(): void {
    this.anchor = null
    this.current = null
  }

  private covers(pos: CellPos): boolean {
    if (!this.anchor || !this.current) return false
    const [top, bottom] = span(this.anchor.row, this.current.row)
    const [left, right] = span(this.anchor.col, this.current.col)
    return pos.row >= top && pos.row <= bottom && pos.col >= left && pos.col <= right
  }
}

const span = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a])
