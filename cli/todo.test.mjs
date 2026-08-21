import { activeTodos, addTodo, completeTodo, syncLearningTodo } from './todo.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('due vocabulary automatically becomes a learning task', () => {
  const now = Date.now()
  const profile = { words: { one: { dueAt: new Date(now - 1).toISOString() } }, todos: [] }
  syncLearningTodo(profile, 'zh-CN', now)
  assert.equal(profile.todos[0].text, '复习 1 个到期单词')
})

test('personal todos can be added and completed', () => {
  const profile = { todos: [] }
  addTodo(profile, 'Practice a sentence')
  assert.equal(activeTodos(profile).length, 1)
  completeTodo(profile, 1)
  assert.equal(activeTodos(profile).length, 0)
})
