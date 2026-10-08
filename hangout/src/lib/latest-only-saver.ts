// Sends saves one at a time, and only ever the newest value.
//
// If someone drags three times during one slow request, the next request
// carries the third selection and the second is never sent. Responses can
// therefore never arrive out of order and overwrite newer data.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface SaverCallbacks<R> {
  /** Response of the newest save (skipped when an even newer value is queued). */
  onResult(result: R): void
  /** Called when the newest save failed. */
  onError(error: unknown): void
  onStatus(status: SaveStatus): void
}

export class LatestOnlySaver<T, R> {
  private readonly save: (value: T) => Promise<R>
  private readonly callbacks: SaverCallbacks<R>
  private queued: { value: T } | null = null
  private running = false

  constructor(save: (value: T) => Promise<R>, callbacks: SaverCallbacks<R>) {
    this.save = save
    this.callbacks = callbacks
  }

  /** True while a request is in flight. */
  get busy(): boolean {
    return this.running
  }

  submit(value: T): void {
    this.queued = { value }
    if (!this.running) void this.run()
  }

  private async run(): Promise<void> {
    this.running = true
    this.callbacks.onStatus('saving')
    let failed = false
    while (this.queued) {
      const { value } = this.queued
      this.queued = null
      try {
        const result = await this.save(value)
        failed = false
        if (!this.queued) this.callbacks.onResult(result)
      } catch (error) {
        failed = true
        if (!this.queued) this.callbacks.onError(error)
      }
    }
    this.running = false
    this.callbacks.onStatus(failed ? 'error' : 'saved')
  }
}
