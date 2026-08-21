import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSystemUsername, systemUsername } from './identity.mjs'

test('normalizes local and qualified system usernames', () => {
  assert.equal(normalizeSystemUsername('pan'), 'pan')
  assert.equal(normalizeSystemUsername('administrator/pan'), 'pan')
  assert.equal(normalizeSystemUsername('DOMAIN\\pan'), 'pan')
  assert.equal(normalizeSystemUsername('company/team/pan'), 'pan')
})

test('rejects empty or unusable usernames', () => {
  assert.equal(normalizeSystemUsername('  '), null)
  assert.equal(normalizeSystemUsername(null), null)
  assert.equal(normalizeSystemUsername('DOMAIN/\u0000pan'), 'pan')
})

test('reads a normalized username from the current system', () => {
  const name = systemUsername()
  assert.ok(name === null || (!name.includes('/') && !name.includes('\\')))
})
