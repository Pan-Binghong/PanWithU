import { collectTodayCodexInputs, codexHome, localDayParts, parseCodexUserInputs } from './codex-inputs.mjs'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('Codex home works across Linux, macOS, and Windows-style home paths', () => {
  assert.equal(codexHome({}, '/home/pan'), join('/home/pan', '.codex'))
  assert.equal(codexHome({}, '/Users/pan'), join('/Users/pan', '.codex'))
  assert.equal(codexHome({}, 'C:\\Users\\Pan'), join('C:\\Users\\Pan', '.codex'))
  assert.equal(codexHome({ CODEX_HOME: '/custom/codex' }, '/ignored'), '/custom/codex')
})

test('only Chinese user messages are collected and secrets are redacted', () => {
  const lines = [
    { timestamp: '2026-08-24T10:00:00Z', type: 'event_msg', payload: { type: 'user_message', message: '帮我检查 api_key=secret-value' } },
    { timestamp: '2026-08-24T10:01:00Z', type: 'event_msg', payload: { type: 'agent_message', message: '不应采集' } },
    { timestamp: '2026-08-24T10:02:00Z', type: 'event_msg', payload: { type: 'user_message', message: 'English only' } },
  ]
  const result = parseCodexUserInputs(lines.map(JSON.stringify).join('\n'))
  assert.deepEqual(result, [{ text: '帮我检查 [已脱敏]', timestamp: '2026-08-24T10:00:00Z' }])
})

test('today collector merges session files in time order and removes duplicates', async () => {
  const root = join(tmpdir(), `pwu-codex-${process.pid}-${Date.now()}`)
  const date = new Date(2026, 7, 24, 18)
  const directory = join(root, 'sessions', ...localDayParts(date))
  await mkdir(directory, { recursive: true })
  const event = (timestamp, message) => JSON.stringify({ timestamp, type: 'event_msg', payload: { type: 'user_message', message } })
  await writeFile(join(directory, 'b.jsonl'), `${event('2026-08-24T02:00:00Z', '第二句')}\n`)
  await writeFile(join(directory, 'a.jsonl'), `${event('2026-08-24T01:00:00Z', '第一句')}\n${event('2026-08-24T03:00:00Z', '第二句')}\n`)
  assert.deepEqual(
    (await collectTodayCodexInputs({ date, root })).map(({ text }) => text),
    ['第一句', '第二句'],
  )
})
