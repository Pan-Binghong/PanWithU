import { PET_STATES, ambientPetState, petStateView } from './pet-state.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('companion exposes a broad set of compact states', () => {
  assert.equal(Object.keys(PET_STATES).length, 15)
  for (const state of Object.values(PET_STATES)) {
    assert.equal(state.frames.length, 2)
    assert.ok(state.zh && state.en)
  }
})

test('state symbols animate and localize without a canvas', () => {
  assert.deepEqual(petStateView('focus', 0, 'zh-CN'), { id: 'focus', symbol: '◆', label: '专注' })
  assert.deepEqual(petStateView('focus', 1, 'en'), { id: 'focus', symbol: '◇', label: 'focused' })
})

test('unknown states are not silently replaced with idle', () => {
  assert.throws(() => petStateView('missing'), /Unknown pet state: missing/)
})

test('ambient state follows pending events and physical needs', () => {
  assert.equal(ambientPetState({ companionAgent: { pendingEvent: { type: 'quiz' } }, energy: 10 }), 'calling')
  assert.equal(ambientPetState({ energy: 20, fullness: 80, mood: 80 }), 'tired')
  assert.equal(ambientPetState({ energy: 80, fullness: 20, mood: 80 }), 'hungry')
  assert.equal(ambientPetState({ energy: 80, fullness: 80, mood: 20 }), 'comfort')
  assert.equal(ambientPetState({ energy: 80, fullness: 80, mood: 80 }), 'idle')
})
