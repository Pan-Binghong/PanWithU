import { COLOR_THEMES, answerPreview, buddyMessages, companionRail, printableKey, setColorTheme } from './tui.mjs'
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

test('companion rail includes speech when space is available', () => {
  assert.equal(companionRail('练习', { name: 'erGou' }, 0, '你真棒', 'zh-CN', 'sleep', 80), 'erGou ᶻ · 睡着了 · “你真棒” · 练习')
})

test('companion rail progressively hides speech and labels on narrow terminals', () => {
  const pet = { name: 'erGou' }
  assert.equal(companionRail('练习', pet, 0, '你真棒', 'zh-CN', 'sleep', 18), 'erGou ᶻ · 练习')
  assert.equal(companionRail('练习', pet, 0, '你真棒', 'zh-CN', 'sleep', 7), 'erGou ᶻ')
})
