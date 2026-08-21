import { PETS } from './constants.mjs'
import {
  COLOR_THEMES,
  PET_ASCII,
  animateSpeciesArt,
  answerPreview,
  applyGrowthArt,
  applyPetExpression,
  buddyView,
  buddyMessages,
  normalizeAsciiArt,
  printableKey,
  setColorTheme,
} from './tui.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('legacy terminal characters are accepted during practice', () => {
  assert.equal(printableKey('c'), 'c')
  assert.equal(printableKey(' '), ' ')
  assert.equal(printableKey('/'), '/')
})

test('control and multi-byte terminal sequences are not treated as answers', () => {
  assert.equal(printableKey('\r'), undefined)
  assert.equal(printableKey('\x1b[A'), undefined)
})

test('buddy speech follows the selected system language', () => {
  assert.equal(buddyMessages('zh-CN').correct, '答对啦！')
  assert.equal(buddyMessages('en').correct, 'That’s right!')
  assert.equal(buddyMessages('zh-CN').label, '伙伴')
  assert.equal(buddyMessages('en').label, 'Buddy')
})

test('dictation answer line does not reveal untyped letters', () => {
  assert.equal(answerPreview('practice', '', 'hideAll'), '········')
  assert.equal(answerPreview('practice', 'pr', 'hideVowel'), 'pr······')
  assert.equal(answerPreview('practice', '', 'learn'), 'practice')
})

test('terminal color themes validate persisted theme ids', () => {
  assert.equal(Object.keys(COLOR_THEMES).length, 7)
  assert.equal(setColorTheme('ocean'), 'ocean')
  assert.equal(setColorTheme('pan'), 'pan')
  assert.equal(setColorTheme('missing'), 'violet')
})

test('buddy art removes only common indentation and preserves its silhouette', () => {
  assert.deepEqual(normalizeAsciiArt(['    @..@', '   ( o.o )', '   / >*< \\']), [' @..@', '( o.o )', '/ >*< \\'])
})

test('all 25 companions have complete compact ASCII sprites', () => {
  assert.equal(Object.keys(PET_ASCII).length, 25)
  assert.deepEqual(Object.keys(PET_ASCII).sort(), PETS.map((pet) => pet.id).sort())
  for (const art of Object.values(PET_ASCII)) {
    assert.ok(art.length >= 3 && art.length <= 5)
    assert.ok(art.every((line) => line.trim().length > 0))
    assert.ok(Math.max(...art.map((line) => line.length)) <= 13)
  }
})

test('pet species have distinct lightweight animation details', () => {
  assert.deepEqual(animateSpeciesArt('frog', ['@..@', '( o.o )'], 1), ['@oo@', '( o.o )'])
  assert.deepEqual(animateSpeciesArt('dog', ['( @.___', '/ O'], 1), ['( @.___', '/ o'])
  assert.deepEqual(animateSpeciesArt('frog', ['@..@'], 2), ['@..@'])
})

test('pet expressions animate eyes without changing a dog tail', () => {
  assert.deepEqual(applyPetExpression('dog', ['(    @\\___', ' /         O'], '-'), ['(    -\\___', ' /         O'])
  assert.deepEqual(applyPetExpression('frog', ['@oo@', '( o.o )'], '^'), ['@oo@', '( ^.^ )'])
})

test('buddy speech is always rendered below the pet art', () => {
  setColorTheme('mono')
  const lines = buddyView({ id: 'frog', name: 'Pip' }, 2, 'Keep going!', 'en', 25, 'cheer', null, 3)
  const plain = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ''))
  assert.equal(plain[0], 'Pip')
  assert.match(plain.at(-1), /Keep going!/)
  assert.ok(plain.findIndex((line) => line.includes('@..@')) < plain.findIndex((line) => line.includes('Keep going!')))
})

test('higher pet levels add restrained growth details', () => {
  assert.deepEqual(applyGrowthArt(['@..@'], 3), ['@..@'])
  assert.deepEqual(applyGrowthArt(['@..@'], 6), ['.  *  .', '@..@'])
  assert.deepEqual(applyGrowthArt(['@..@'], 10), ['* .*. *', '@..@'])
  assert.deepEqual(animateSpeciesArt('frog', ['@..@'], 1, 'idle', 1), ['@..@'])
})
