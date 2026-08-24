import { PETS } from './constants.mjs'
import { ambientPetState, petStateView } from './pet-state.mjs'
import { colors, paint } from './ui.mjs'

function shanghaiDay(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function currentPet(config) {
  const pet = PETS.find((item) => item.id === config.pet)
  if (!pet) throw new Error(`Unknown pet: ${config.pet}`)
  const customName = typeof config.petName === 'string' ? config.petName.trim() : ''
  return { ...pet, type: pet.id, defaultName: pet.name, name: customName || pet.name }
}

export function petGrowthStage(level = 1, language = 'zh-CN') {
  const stages = [
    { id: 'new', minLevel: 1, nextLevel: 3, zh: '初识伙伴', en: 'New friend' },
    { id: 'bonded', minLevel: 3, nextLevel: 6, zh: '默契伙伴', en: 'Close buddy' },
    { id: 'shining', minLevel: 6, nextLevel: 10, zh: '闪耀伙伴', en: 'Shining partner' },
    { id: 'star', minLevel: 10, nextLevel: null, zh: '星光挚友', en: 'Star companion' },
  ]
  const numericLevel = Math.max(1, Number(level) || 1)
  const stage = [...stages].reverse().find((item) => numericLevel >= item.minLevel) || stages[0]
  return { ...stage, name: language === 'en' ? stage.en : stage.zh }
}

function updatePetLevel(profile) {
  profile.petLevel = Math.floor(profile.bond / 50) + 1
}

export function showPet(config, profile) {
  const pet = currentPet(config)
  const state = petStateView(ambientPetState(profile), 0, config.language)
  console.log(`\n${paint(colors.pink, `${pet.name}  ${state.symbol}`)}`)
  console.log(`${state.label}  ·  Lv.${profile.petLevel}  ♡ ${profile.bond}`)
  console.log(`⭐ ${profile.stars}  mood ${profile.mood}%  energy ${profile.energy}%  full ${profile.fullness}%`)
}

export async function animatePet(config, { action = 'play', message = '' } = {}) {
  if (!process.stdout.isTTY) return
  const pet = currentPet(config)
  for (let index = 0; index < 4; index += 1) {
    const state = petStateView(action === 'feed' ? 'feed' : 'play', index, config.language)
    process.stdout.write(`\r${paint(colors.pink, `${pet.name}  ${state.symbol}`)}  ${paint(colors.yellow, state.label)}`)
    await new Promise((resolve) => setTimeout(resolve, 90))
  }
  process.stdout.write('\r\x1b[0J')
  if (message) process.stdout.write(`${paint(colors.pink, message)}\n`)
}

export function feed(config, profile, language = 'zh-CN') {
  const pet = currentPet(config)
  if (profile.stars < 5)
    return language === 'en'
      ? `${pet.name}: Let’s learn a few more words, then we can share a snack.`
      : `${pet.name}：再学几个单词，我们就能一起吃点心啦。`
  profile.stars -= 5
  profile.fullness = Math.min(100, profile.fullness + 18)
  profile.mood = Math.min(100, profile.mood + 5)
  profile.bond += 3
  updatePetLevel(profile)
  return language === 'en'
    ? `${pet.name}: Yum, thank you for staying with me.  -5 stars  +3 bond`
    : `${pet.name}：好吃！谢谢你陪我。  -5 星星  +3 羁绊`
}

export function play(config, profile, language = 'zh-CN') {
  const pet = currentPet(config)
  if (profile.energy < 10)
    return language === 'en' ? `${pet.name} yawns and needs a little rest first.` : `${pet.name} 打了个哈欠，想先休息一下。`
  profile.energy -= 10
  profile.mood = Math.min(100, profile.mood + 15)
  profile.bond += 4
  updatePetLevel(profile)
  return language === 'en' ? `${pet.name} chased the ball three times!  +4 bond` : `${pet.name} 追着小球跑了三圈！  +4 羁绊`
}

export function claimDailyCompanion(profile, language = 'zh-CN', now = new Date()) {
  const day = shanghaiDay(now)
  if (profile.lastCompanionDay === day) return { awarded: false, stars: 0, bond: 0, message: '' }
  profile.lastCompanionDay = day
  profile.companionDays = Number(profile.companionDays || 0) + 1
  profile.stars += 5
  profile.bond += 5
  updatePetLevel(profile)
  return {
    awarded: true,
    stars: 5,
    bond: 5,
    message:
      language === 'en'
        ? `Our ${profile.companionDays}-day study date!  +5 stars  +5 bond`
        : `第 ${profile.companionDays} 天一起学习！  +5 星星  +5 羁绊`,
  }
}
