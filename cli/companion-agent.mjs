import { askAsPet } from './ai.mjs'
import { currentPet } from './pet.mjs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

export function chooseCompanionActivity(profile, random = Math.random) {
  const hasWords = Object.keys(profile.words || {}).length > 0
  if (!hasWords) return 'greeting'
  const choices = ['quiz', 'story', 'greeting'].filter((type) => type !== profile.companionAgent?.lastEventType)
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
}

function localDay(now) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shouldSendCompanionEvent(config, profile, { now = new Date(), random = Math.random, force = false } = {}) {
  if (force) return { send: true, reason: 'forced' }
  const policy = config.companionAgent || {}
  if (policy.enabled === false) return { send: false, reason: 'disabled' }
  const start = Number(policy.quietHours?.start ?? 9)
  const end = Number(policy.quietHours?.end ?? 22)
  const hour = now.getHours()
  if (hour < start || hour >= end) return { send: false, reason: 'quiet-hours' }
  const state = profile.companionAgent || {}
  const today = localDay(now)
  const todayCount = state.eventDay === today ? Number(state.eventCount || 0) : 0
  if (todayCount >= Number(policy.maxEventsPerDay ?? 2)) return { send: false, reason: 'daily-limit' }
  const lastAt = state.lastEventAt ? new Date(state.lastEventAt).getTime() : 0
  const minGap = Number(policy.minGapHours ?? 5) * 3_600_000
  if (lastAt && now.getTime() - lastAt < minGap) return { send: false, reason: 'minimum-gap' }
  if (todayCount === 0 && hour >= end - 3) return { send: true, reason: 'daily-moment' }
  return random() < 0.35 ? { send: true, reason: 'natural-moment' } : { send: false, reason: 'not-now' }
}

async function knownWord(profile, random = Math.random) {
  const names = Object.keys(profile.words || {})
  if (!names.length) return null
  const word = names[Math.min(names.length - 1, Math.floor(random() * names.length))]
  try {
    const dictionary = JSON.parse(await readFile(join(root, 'public', 'dicts', 'CET4_T.json'), 'utf8'))
    const entry = dictionary.find((item) => item.name === word)
    if (!entry?.trans?.[0]) return null
    return { word, translation: entry.trans[0] }
  } catch {
    return null
  }
}

export async function createCompanionEvent(config, profile, { random = Math.random, now = new Date(), generate = askAsPet } = {}) {
  if (!config.invitationCode) return null
  const activity = chooseCompanionActivity(profile, random)
  const context = activity === 'greeting' ? {} : await knownWord(profile, random)
  if (!context) return null
  let message
  try {
    message = await generate(config, profile, activity, context)
  } catch {
    return null
  }
  if (!message?.trim()) return null
  const pet = currentPet(config)
  const event = {
    id: `${now.getTime()}-${activity}`,
    type: activity,
    message,
    word: context?.word || null,
    createdAt: now.toISOString(),
  }
  profile.companionAgent ||= {}
  profile.companionAgent.lastEventAt = event.createdAt
  profile.companionAgent.lastEventType = activity
  profile.companionAgent.pendingEvent = event
  const day = localDay(now)
  profile.companionAgent.eventCount = profile.companionAgent.eventDay === day ? Number(profile.companionAgent.eventCount || 0) + 1 : 1
  profile.companionAgent.eventDay = day
  return { ...event, title: `${pet.name} · PanwithU` }
}

export async function runCompanionAgent(config, profile, options = {}) {
  if (!config.invitationCode) return { sent: false, reason: 'missing-api-key' }
  const decision = shouldSendCompanionEvent(config, profile, options)
  if (!decision.send) return { sent: false, reason: decision.reason }
  const event = await createCompanionEvent(config, profile, options)
  if (!event) return { sent: false, reason: 'agent-unavailable' }
  return { sent: true, reason: decision.reason, event }
}
