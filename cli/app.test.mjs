import { yuSecret } from './app.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('the author easter egg preserves its private message', () => {
  const output = yuSecret()
  assert.match(output, /98946893696942646453/)
  assert.doesNotMatch(output, /余洲雯/)
  assert.match(output, /— Pan/)
  assert.doesNotMatch(output, /♡/)
})
