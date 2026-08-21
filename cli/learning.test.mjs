import { recommendedCount, selectWords, updateWordMemory } from './learning.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('due and failed words are selected before unseen words', () => {
  const now = Date.now()
  const items = [{ name: 'due' }, { name: 'new' }, { name: 'future' }]
  const profile = {
    words: {
      due: { dueAt: new Date(now - 1000).toISOString() },
      future: { dueAt: new Date(now + 1000).toISOString() },
    },
  }
  assert.equal(selectWords(items, profile, 2, now)[0].name, 'due')
})

test('word memory schedules success and quickly retries mistakes', () => {
  const now = Date.now()
  const profile = { words: {} }
  const correct = updateWordMemory(profile, 'companion', true, now)
  assert.equal(correct.intervalDays, 1)
  assert.equal(new Date(correct.dueAt).getTime(), now + 86_400_000)
  const wrong = updateWordMemory(profile, 'companion', false, now)
  assert.equal(wrong.intervalDays, 0)
  assert.equal(new Date(wrong.dueAt).getTime(), now + 600_000)
})

test('practice size adapts to recent accuracy', () => {
  assert.equal(recommendedCount({ sessions: [] }), 5)
  assert.equal(recommendedCount({ sessions: [{ count: 10, correct: 8 }] }), 7)
  assert.equal(recommendedCount({ sessions: [{ count: 10, correct: 10 }] }), 10)
})
