import { askAsPet } from './ai.mjs'
import { systemUsername } from './identity.mjs'
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
  if (todayCount >= Math.min(30, Number(policy.maxEventsPerDay ?? 30))) return { send: false, reason: 'daily-limit' }
  const lastAt = state.lastEventAt ? new Date(state.lastEventAt).getTime() : 0
  const minGap = Number(policy.minGapHours ?? 0.5) * 3_600_000
  if (lastAt && now.getTime() - lastAt < minGap) return { send: false, reason: 'minimum-gap' }
  if (todayCount === 0 && hour >= end - 3) return { send: true, reason: 'daily-moment' }
  return random() < 0.12 ? { send: true, reason: 'natural-moment' } : { send: false, reason: 'not-now' }
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
  if ((profile.companionAgent?.recentMessages || []).includes(message.trim())) return null
  const pet = currentPet(config)
  const event = {
    id: `${now.getTime()}-${activity}`,
    type: activity,
    message,
    word: context?.word || null,
    createdAt: now.toISOString(),
  }
  recordCompanionEvent(profile, event, now)
  return { ...event, title: `${pet.name} · PanwithU` }
}

function recordCompanionEvent(profile, event, now) {
  profile.companionAgent ||= {}
  profile.companionAgent.lastEventAt = event.createdAt
  profile.companionAgent.lastEventType = event.type
  profile.companionAgent.pendingEvent = event
  const recent = profile.companionAgent.recentMessages || []
  profile.companionAgent.recentMessages = [event.message, ...recent.filter((message) => message !== event.message)].slice(0, 30)
  const day = localDay(now)
  profile.companionAgent.eventCount = profile.companionAgent.eventDay === day ? Number(profile.companionAgent.eventCount || 0) + 1 : 1
  profile.companionAgent.eventDay = day
}

export function createLocalCompanionEvent(config, profile, { now = new Date() } = {}) {
  const pet = currentPet(config)
  const name = profile.userProfile?.name || systemUsername()
  const address = name ? `，${name}` : ''
  const hour = now.getHours()
  const count = profile.companionAgent?.eventDay === localDay(now) ? Number(profile.companionAgent.eventCount || 0) : 0
  const zhOpenings =
    hour < 10
      ? ['早上好', '新的一天开始啦', '早呀', '太阳出来了', '我醒来啦']
      : hour < 14
      ? ['中午好呀', '到午休时间了', '忙了一上午啦', '午间小憩一下吧', '我来看看你']
      : hour < 18
      ? ['下午好', '忙到现在辛苦啦', '下午也要加油呀', '我来陪你一会儿', '伸个懒腰吧']
      : ['晚上好', '今天辛苦啦', '夜色到了', '忙完了吗', '我还在这里']
  const zhEndings = [
    hour >= 10 && hour < 14 ? '吃饭了吗？' : '慢慢来，我陪着你。',
    '记得喝口水。',
    '休息一分钟也很好。',
    '今天过得怎么样？',
    '来学一句英语吧。',
    '别忘了照顾自己。',
  ]
  const zh = `${zhOpenings[count % zhOpenings.length]}${address}。${zhEndings[Math.floor(count / zhOpenings.length) % zhEndings.length]}`
  const enName = name ? `, ${name}` : ''
  const enOpenings =
    hour < 10
      ? ['Good morning', 'Morning', 'A new day begins', 'The sun is up', 'I’m awake']
      : hour < 18
      ? ['Good afternoon', 'Quick check-in', 'You’ve worked hard', 'Break time', 'I’m here']
      : ['Good evening', 'Long day', 'Night is here', 'Finished working', 'I’m still here']
  const enEndings = [
    'Take it slowly.',
    'Have some water.',
    'A short break helps.',
    'How are you doing?',
    'Let’s learn one phrase.',
    'Be kind to yourself.',
  ]
  const en = `${enOpenings[count % enOpenings.length]}${enName}. ${enEndings[Math.floor(count / enOpenings.length) % enEndings.length]}`
  const event = {
    id: `${now.getTime()}-greeting`,
    type: 'greeting',
    message: config.language === 'en' ? en : zh,
    word: null,
    createdAt: now.toISOString(),
  }
  recordCompanionEvent(profile, event, now)
  return { ...event, title: `${pet.name} · PanwithU` }
}

export async function runCompanionAgent(config, profile, options = {}) {
  const decision = shouldSendCompanionEvent(config, profile, options)
  if (!decision.send) return { sent: false, reason: decision.reason }
  const generated = config.invitationCode ? await createCompanionEvent(config, profile, options) : null
  const event = generated || createLocalCompanionEvent(config, profile, options)
  return { sent: true, reason: generated ? decision.reason : 'local-routine', event }
}
