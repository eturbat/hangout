import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CoalescingRunner } from './coalescing-runner.ts'

// A task whose runs finish only when the test says so
function controlledTask() {
  const finishers: (() => void)[] = []
  let runs = 0
  const task = () => {
    runs++
    return new Promise<void>((resolve) => finishers.push(resolve))
  }
  return {
    task,
    get runs() {
      return runs
    },
    finishNext: async () => {
      finishers.shift()?.()
      await new Promise((resolve) => setImmediate(resolve))
    },
  }
}

test('runs right away when idle', async () => {
  const t = controlledTask()
  const runner = new CoalescingRunner(t.task)
  const done = runner.request()
  assert.equal(t.runs, 1)
  await t.finishNext()
  await done
})

test('coalesces requests made during a run into one rerun', async () => {
  const t = controlledTask()
  const runner = new CoalescingRunner(t.task)
  void runner.request()
  void runner.request()
  void runner.request()
  const last = runner.request()
  assert.equal(t.runs, 1)

  await t.finishNext()
  assert.equal(t.runs, 2, 'one rerun for all the requests made while running')
  await t.finishNext()
  await last
  assert.equal(t.runs, 2)
})

test('keeps going after the task fails', async () => {
  let runs = 0
  const runner = new CoalescingRunner(async () => {
    runs++
    if (runs === 1) throw new Error('offline')
  })
  await runner.request()
  await runner.request()
  assert.equal(runs, 2)
})
