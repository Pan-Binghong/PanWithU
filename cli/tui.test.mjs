import {
  COLOR_THEMES,
  answerPreview,
  buddyMessages,
  commandSuggestions,
  companionRail,
  nextHintIndex,
  practiceGlyph,
  printableKey,
  sessionAccuracy,
  sessionEncouragementFallback,
  setColorTheme,
  submittedAnswerCorrect,
} from './tui.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

const plain = (value) => value.replace(/\x1b\[[0-9;]*m/g, '')

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

test('sentence spaces are rendered as short underscores without changing input', () => {
  assert.equal(practiceGlyph(' '), '_')
  assert.equal(practiceGlyph('a'), 'a')
  assert.equal([...answerPreview('How are you?', 'How', 'learn')].map(practiceGlyph).join(''), 'How_are_you?')
})

test('non-learning session summary reports accuracy in the pet voice', () => {
  assert.equal(sessionAccuracy(4, 5), 80)
  assert.equal(sessionAccuracy(0, 0), 0)
  assert.match(sessionEncouragementFallback(80, 'zh-CN'), /正确率 80%/)
  assert.match(sessionEncouragementFallback(100, 'en'), /100% accuracy/)
})

test('practice answers are judged from the final text submitted with Enter', () => {
  assert.equal(submittedAnswerCorrect('practice', 'practice'), true)
  assert.equal(submittedAnswerCorrect('Practice', 'practice'), true)
  assert.equal(submittedAnswerCorrect('practice', 'practicf'), false)
  assert.equal(submittedAnswerCorrect('practice', 'practic'), false)
})

test('Ctrl+P hints reveal hidden letters in order and skip visible characters', () => {
  const hints = new Set()
  assert.equal(nextHintIndex('practice', 0, hints, 'hideAll'), 0)
  hints.add(0)
  assert.equal(nextHintIndex('practice', 0, hints, 'hideAll'), 1)
  assert.equal(nextHintIndex('practice', 0, new Set(), 'hideVowel'), 2)
  assert.equal(nextHintIndex('go home', 2, new Set(), 'hideAll'), 3)
  assert.equal(nextHintIndex('practice', 0, new Set(), 'learn'), -1)
})

test('terminal color themes validate persisted theme ids', () => {
  assert.equal(Object.keys(COLOR_THEMES).length, 7)
  assert.equal(setColorTheme('ocean'), 'ocean')
  assert.equal(setColorTheme('pan'), 'pan')
  assert.equal(setColorTheme('missing'), 'violet')
})

test('companion rail includes speech when space is available', () => {
  const rail = companionRail('练习', { name: 'erGou' }, 0, '你真棒', 'zh-CN', 'sleep', 80)
  assert.equal(plain(rail), 'erGou ᶻ · 睡着了 · “你真棒” · 练习')
  assert.match(rail, /\x1b\[38;5;84mᶻ · 睡着了/)
})

test('companion rail progressively hides speech and labels on narrow terminals', () => {
  const pet = { name: 'erGou' }
  assert.equal(plain(companionRail('练习', pet, 0, '你真棒', 'zh-CN', 'sleep', 18)), 'erGou ᶻ · 练习')
  assert.equal(plain(companionRail('练习', pet, 0, '你真棒', 'zh-CN', 'sleep', 7)), 'erGou ᶻ')
})

test('slash completion exposes direct pet commands and filters as the user types', () => {
  const all = commandSuggestions().map(({ name }) => name)
  assert.ok(all.includes('rename'))
  assert.ok(all.includes('status'))
  assert.ok(all.includes('feed'))
  assert.ok(all.includes('play'))
  assert.ok(all.includes('t'))
  assert.deepEqual(
    commandSuggestions('/ren').map(({ name }) => name),
    ['rename'],
  )
})
