import { chooseCompanionActivity, createCompanionEvent, runCompanionAgent, shouldSendCompanionEvent } from './companion-agent.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

const config = { language: 'zh-CN', invitationCode: 'test-key', pet: 'cat', petName: '团子' }

test('companion activity stays local-first and requires known words for learning events', () => {
  assert.equal(
    chooseCompanionActivity({ words: {} }, () => 0),
    'greeting',
  )
  assert.equal(
    chooseCompanionActivity({ words: { hello: {} } }, () => 0.1),
    'quiz',
  )
  assert.equal(
    chooseCompanionActivity({ words: { hello: {} } }, () => 0.6),
    'story',
  )
})

test('renamed pet owns an agent-generated notification and pending event', async () => {
  const profile = { words: {}, sessions: [], companionAgent: {} }
  const event = await createCompanionEvent(config, profile, {
    random: () => 0,
    now: new Date('2026-08-21T08:00:00Z'),
    generate: async () => '团子想和你一起学一个单词。',
  })
  assert.equal(event.type, 'greeting')
  assert.match(event.title, /^团子/)
  assert.match(event.message, /团子/)
  assert.equal(profile.companionAgent.pendingEvent.id, event.id)
})

test('missing API keys and failed agents do not create fallback pet messages', async () => {
  const profile = { words: {}, sessions: [], companionAgent: {} }
  assert.equal((await runCompanionAgent({ ...config, invitationCode: '' }, profile, { force: true })).reason, 'missing-api-key')
  const result = await runCompanionAgent(config, profile, { force: true, generate: async () => null })
  assert.deepEqual(result, { sent: false, reason: 'agent-unavailable' })
  assert.equal(profile.companionAgent.pendingEvent, undefined)
})

test('background companion stays quiet and caps daily interruptions', () => {
  const policy = {
    companionAgent: { enabled: true, quietHours: { start: 9, end: 22 }, maxEventsPerDay: 2, minGapHours: 5 },
  }
  assert.equal(
    shouldSendCompanionEvent(policy, { companionAgent: {} }, { now: new Date(2026, 7, 21, 8), random: () => 0 }).reason,
    'quiet-hours',
  )
  assert.equal(
    shouldSendCompanionEvent(
      policy,
      { companionAgent: { eventDay: '2026-08-21', eventCount: 2 } },
      { now: new Date(2026, 7, 21, 19), random: () => 0 },
    ).reason,
    'daily-limit',
  )
  assert.equal(
    shouldSendCompanionEvent(policy, { companionAgent: {} }, { now: new Date(2026, 7, 21, 19), random: () => 1 }).reason,
    'daily-moment',
  )
})
