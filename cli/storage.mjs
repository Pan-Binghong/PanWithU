import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const configRoot = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
const dataRoot = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')

export const paths = {
  config: join(configRoot, 'panwithu', 'config.json'),
  profile: join(dataRoot, 'panwithu', 'profile.json'),
  audio: join(dataRoot, 'panwithu', 'audio'),
  reminders: join(configRoot, 'panwithu', 'reminders'),
}

export const defaultCompanionAgentConfig = {
  enabled: true,
  mode: 'automatic',
  quietHours: { start: 9, end: 22 },
  maxEventsPerDay: 2,
  minGapHours: 5,
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return structuredClone(fallback)
    throw error
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, path)
}

export const defaultProfile = {
  stars: 0,
  bond: 0,
  petLevel: 1,
  mood: 80,
  energy: 80,
  fullness: 70,
  learned: 0,
  correct: 0,
  wrong: 0,
  streak: 0,
  inventory: { apple: 1, cookie: 0, ball: 1 },
  companionDays: 0,
  lastCompanionDay: null,
  lastAiCoachDay: null,
  companionAgent: {
    lastEventAt: null,
    lastEventType: null,
    pendingEvent: null,
    eventDay: null,
    eventCount: 0,
  },
  userProfile: {
    name: null,
    firstSeenAt: null,
    updatedDay: null,
    activeDays: 0,
    visitHours: [],
    usualTime: null,
    preferredPracticeMode: 'learn',
    recentSessions: 0,
    recentAccuracy: null,
    averageSessionWords: 0,
  },
  words: {},
  todos: [],
  achievements: [],
  sessions: [],
  lastSeenAt: null,
}

export async function loadConfig() {
  const stored = await readJson(paths.config, null)
  if (!stored) return null
  return {
    ...stored,
    pet: 'cat',
    companionAgent: {
      ...defaultCompanionAgentConfig,
      ...stored.companionAgent,
      quietHours: {
        ...defaultCompanionAgentConfig.quietHours,
        ...stored.companionAgent?.quietHours,
      },
    },
  }
}
export const saveConfig = (config) => writeJson(paths.config, config)
export async function loadProfile() {
  const stored = await readJson(paths.profile, defaultProfile)
  const profile = {
    ...structuredClone(defaultProfile),
    ...stored,
    inventory: { ...defaultProfile.inventory, ...stored.inventory },
    companionAgent: { ...defaultProfile.companionAgent, ...stored.companionAgent },
    userProfile: { ...defaultProfile.userProfile, ...stored.userProfile },
  }
  delete profile.petAccessories
  delete profile.equippedAccessory
  if (profile.lastSeenAt) {
    const elapsed = Date.now() - new Date(profile.lastSeenAt).getTime()
    if (Number.isFinite(elapsed) && elapsed > 0) {
      profile.energy = Math.min(100, profile.energy + Math.floor(elapsed / 600_000))
    }
  }
  profile.petLevel = Math.floor(profile.bond / 50) + 1
  return profile
}
export const saveProfile = (profile) => writeJson(paths.profile, profile)
