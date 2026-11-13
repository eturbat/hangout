// Runs a task at most once at a time, and coalesces requests that arrive while
// it runs into a single rerun afterwards.
//
// Used to refetch the event when the server says it changed: ten saves in a
// row cause at most two requests, and a change made during a refetch is never
// missed, because a rerun always starts after it.

export class CoalescingRunner {
  private readonly task: () => Promise<void>
  private pending = false
  private current: Promise<void> | null = null

  constructor(task: () => Promise<void>) {
    this.task = task
  }

  /** Runs the task soon. The promise settles once a run that started after this call has finished. */
  request(): Promise<void> {
    this.pending = true
    this.current ??= this.run()
    return this.current
  }

  private async run(): Promise<void> {
    try {
      while (this.pending) {
        this.pending = false
        try {
          await this.task()
        } catch {
          // The task reports its own errors. Keep serving later requests.
        }
      }
    } finally {
      this.current = null
    }
  }
}
