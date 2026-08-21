import { speak } from './audio.mjs'
import { colors, paint } from './ui.mjs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const minute = 60_000
const day = 86_400_000

async function words() {
  return JSON.parse(await readFile(join(root, 'public', 'dicts', 'CET4_T.json'), 'utf8'))
}

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function recommendedCount(profile) {
  const recent = profile.sessions.slice(-3)
  if (!recent.length) return 5
  const attempts = recent.reduce((sum, session) => sum + session.count, 0)
  const correct = recent.reduce((sum, session) => sum + session.correct, 0)
  const accuracy = attempts ? correct / attempts : 0
  if (accuracy >= 0.9) return 10
  if (accuracy >= 0.7) return 7
  return 5
}

export function selectWords(items, profile, count, now = Date.now()) {
  const memory = profile.words || {}
  const due = items
    .filter((entry) => memory[entry.name]?.dueAt && new Date(memory[entry.name].dueAt).getTime() <= now)
    .sort((left, right) => new Date(memory[left.name].dueAt) - new Date(memory[right.name].dueAt))
  const dueNames = new Set(due.map((entry) => entry.name))
  const unseen = shuffle(items.filter((entry) => !memory[entry.name] && !dueNames.has(entry.name)))
  const future = items
    .filter((entry) => memory[entry.name] && !dueNames.has(entry.name))
    .sort((left, right) => new Date(memory[left.name].dueAt) - new Date(memory[right.name].dueAt))
  return [...due, ...unseen, ...future].slice(0, count)
}

export function updateWordMemory(profile, word, isCorrect, now = Date.now()) {
  profile.words ||= {}
  const previous = profile.words[word] || { seen: 0, correct: 0, wrong: 0, intervalDays: 0, ease: 2.3 }
  const next = { ...previous, seen: previous.seen + 1, lastAt: new Date(now).toISOString() }
  if (isCorrect) {
    next.correct += 1
    next.ease = Math.min(3, next.ease + 0.05)
    next.intervalDays =
      previous.intervalDays <= 0 ? 1 : previous.intervalDays === 1 ? 3 : Math.min(60, Math.round(previous.intervalDays * next.ease))
    next.dueAt = new Date(now + next.intervalDays * day).toISOString()
  } else {
    next.wrong += 1
    next.ease = Math.max(1.3, next.ease - 0.2)
    next.intervalDays = 0
    next.dueAt = new Date(now + 10 * minute).toISOString()
  }
  profile.words[word] = next
  return next
}

export async function learn(rl, config, profile, requestedCount) {
  const count = Math.max(1, Math.min(Number(requestedCount) || recommendedCount(profile), 20))
  const selected = selectWords(await words(), profile, count)
  let correct = 0
  const isChinese = config.language === 'zh-CN'
  console.log(`\n${paint(colors.yellow, isChinese ? '今天的小旅程开始啦 ✦' : 'Today’s little journey begins ✦')}\n`)
  for (const entry of selected) {
    const translation = entry.trans?.[0] || ''
    const phone = config.accent === 'uk' ? entry.ukphone : entry.usphone
    console.log(`${paint(colors.dim, translation)}  ${phone ? `/ ${phone} /` : ''}`)
    void speak(entry.name, config, { accent: config.accent }).catch(() => ({ played: false }))
    const answer = (await rl.question(isChinese ? '拼写 > ' : 'spell > ')).trim().toLowerCase()
    const isCorrect = answer === entry.name.toLowerCase()
    updateWordMemory(profile, entry.name, isCorrect)
    if (isCorrect) {
      correct += 1
      profile.streak += 1
      const reward = 2 + Math.min(Math.floor(profile.streak / 3), 3)
      profile.stars += reward
      profile.bond += 2
      console.log(paint(colors.green, `✓ ${entry.name}  +${reward} ⭐\n`))
    } else {
      profile.streak = 0
      console.log(paint(colors.red, `${isChinese ? '正确答案' : 'answer'} → ${entry.name}\n`))
      void speak(entry.name, config, { accent: config.accent, slow: true }).catch(() => ({ played: false }))
    }
  }
  profile.learned += selected.length
  profile.correct += correct
  profile.wrong += selected.length - correct
  profile.petLevel = Math.floor(profile.bond / 50) + 1
  profile.energy = Math.max(10, profile.energy - 5)
  profile.sessions.push({ at: new Date().toISOString(), count: selected.length, correct })
  profile.sessions = profile.sessions.slice(-100)
  if (correct === selected.length) profile.inventory.cookie += 1
  return { count: selected.length, correct }
}
