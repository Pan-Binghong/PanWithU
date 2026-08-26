import { askCoach, parsePersonalDictionaryJson, translationDirection } from './ai.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('AI dictionary output becomes a normal practice entry', () => {
  const inputs = [{ text: '你今天过得怎么样？', timestamp: '2026-08-24T10:00:00Z' }]
  const result = parsePersonalDictionaryJson(
    '```json\n[{"id":0,"chinese":"你今天过得怎么样？","english":"How are you today?"}]\n```',
    inputs,
  )
  assert.deepEqual(result, [
    {
      name: 'How are you today?',
      trans: ['你今天过得怎么样？'],
      sourceText: '你今天过得怎么样？',
      timestamp: '2026-08-24T10:00:00Z',
    },
  ])
})

test('invalid and attachment-only AI results are omitted', () => {
  const inputs = [{ text: '图片如下', timestamp: null }]
  assert.deepEqual(parsePersonalDictionaryJson('[]', inputs), [])
  assert.deepEqual(parsePersonalDictionaryJson('[{"id":4,"chinese":"图片如下","english":"Image below"}]', inputs), [])
})

test('one Codex input can become multiple short non-duplicate sentences', () => {
  const inputs = [{ text: '帮我删掉蝙蝠侠，然后检查结果。', timestamp: null }]
  const answer = JSON.stringify([
    { id: 0, chinese: '帮我删掉蝙蝠侠。', english: 'Please remove Batman.' },
    { id: 0, chinese: '然后检查一下结果。', english: 'Then check the result.' },
    { id: 0, chinese: '然后检查一下结果。', english: 'Then check the result.' },
    {
      id: 0,
      chinese: '这句话太长。',
      english:
        'This sentence contains far too many separate words to remain a useful focused learning item inside this compact terminal practice experience.',
    },
  ])
  assert.deepEqual(
    parsePersonalDictionaryJson(answer, inputs).map(({ name }) => name),
    ['Please remove Batman.', 'Then check the result.'],
  )
})

test('AI dictionary parser accepts wrapped JSON objects and brief preambles', () => {
  const inputs = [{ text: '你好吗？', timestamp: null }]
  assert.equal(
    parsePersonalDictionaryJson('Result:\n{"entries":[{"id":0,"chinese":"你好吗？","english":"How are you?"}]}', inputs)[0].name,
    'How are you?',
  )
})

test('translation direction is inferred from the input text', () => {
  assert.deepEqual(translationDirection('hello'), { source: 'English', target: 'Simplified Chinese' })
  assert.deepEqual(translationDirection('日期'), { source: 'Chinese', target: 'English' })
})

test('AI requests use the lightweight OpenAI-compatible endpoint', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => ({ choices: [{ message: { content: ' Keep going! ' } }] }) }
  }
  try {
    const answer = await askCoach(
      { invitationCode: 'test-code', language: 'en', pet: 'cat' },
      { learned: 2, correct: 1, wrong: 1, streak: 0, sessions: [] },
      'Encourage me.',
    )
    assert.equal(answer, 'Keep going!')
    assert.equal(request.url, 'https://www.dmxapi.cn/v1/chat/completions')
    assert.equal(request.options.headers.Authorization, 'Bearer test-code')
    assert.deepEqual(
      JSON.parse(request.options.body).messages.map(({ role }) => role),
      ['system', 'user'],
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
