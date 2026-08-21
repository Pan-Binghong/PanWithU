export function dueWordCount(profile, now = Date.now()) {
  return Object.values(profile.words || {}).filter((word) => word.dueAt && new Date(word.dueAt).getTime() <= now).length
}

export function syncLearningTodo(profile, language, now = Date.now()) {
  profile.todos ||= []
  const count = dueWordCount(profile, now)
  const index = profile.todos.findIndex((todo) => todo.id === 'review-due')
  if (!count) {
    if (index >= 0) profile.todos.splice(index, 1)
    return
  }
  const todo = {
    id: 'review-due',
    text: language === 'zh-CN' ? `复习 ${count} 个到期单词` : `Review ${count} due words`,
    system: true,
    done: false,
    updatedAt: new Date(now).toISOString(),
  }
  if (index >= 0) profile.todos[index] = todo
  else profile.todos.unshift(todo)
}

export function addTodo(profile, text) {
  profile.todos ||= []
  const todo = { id: `todo-${Date.now()}`, text, system: false, done: false, createdAt: new Date().toISOString() }
  profile.todos.push(todo)
  return todo
}

export function completeTodo(profile, visibleIndex) {
  const active = (profile.todos || []).filter((todo) => !todo.done)
  const todo = active[visibleIndex - 1]
  if (!todo) return null
  todo.done = true
  todo.completedAt = new Date().toISOString()
  return todo
}

export function activeTodos(profile) {
  return (profile.todos || []).filter((todo) => !todo.done)
}
