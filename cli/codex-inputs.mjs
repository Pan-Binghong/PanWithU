import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function codexHome(env = process.env, home = homedir()) {
  return env.CODEX_HOME || join(home, '.codex')
}

export function localDayParts(date = new Date()) {
  return [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')]
}

function cleanUserInput(value) {
  return String(value || '')
    .replace(/<recommended_plugins>[\s\S]*?<\/recommended_plugins>/gi, '')
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
    .replace(/# AGENTS\.md instructions[\s\S]*?<\/INSTRUCTIONS>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|(?:api[_-]?key|token|password)\s*[:=]\s*\S+)/gi, '[已脱敏]')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseCodexUserInputs(jsonl) {
  const messages = []
  for (const line of String(jsonl).split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line)
      if (event.type !== 'event_msg' || event.payload?.type !== 'user_message') continue
      const text = cleanUserInput(event.payload.message)
      if (text && /\p{Script=Han}/u.test(text)) messages.push({ text, timestamp: event.timestamp || null })
    } catch {}
  }
  return messages
}

export async function collectTodayCodexInputs({ date = new Date(), root = codexHome() } = {}) {
  const directory = join(root, 'sessions', ...localDayParts(date))
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl')).map((entry) => join(directory, entry.name))
  const batches = await Promise.all(files.map((file) => readFile(file, 'utf8').then(parseCodexUserInputs)))
  const unique = new Map()
  for (const message of batches.flat().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))) {
    if (!unique.has(message.text)) unique.set(message.text, message)
  }
  return [...unique.values()]
}
