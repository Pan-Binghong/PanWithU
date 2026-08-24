import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function codexHome(env = process.env, home = homedir()) {
  return env.CODEX_HOME || join(home, '.codex')
}

export function agentHistoryRoots(env = process.env, home = homedir()) {
  return [
    { id: 'codex', path: codexHome(env, home) },
    { id: 'claude', path: env.CLAUDE_CONFIG_DIR || join(home, '.claude') },
    { id: 'kiro', path: env.KIRO_HOME || join(home, '.kiro') },
    { id: 'openclaw', path: env.OPENCLAW_HOME || join(home, '.openclaw') },
    { id: 'hermes', path: env.HERMES_HOME || join(home, '.hermes') },
    { id: 'harness', path: env.HARNESS_HOME || join(home, '.harness') },
    { id: 'harnes', path: join(home, '.harnes') },
    { id: 'cursor', path: join(home, '.cursor') },
    { id: 'gemini', path: env.GEMINI_HOME || join(home, '.gemini') },
    { id: 'qwen', path: env.QWEN_HOME || join(home, '.qwen') },
    { id: 'kimi', path: join(home, '.kimi') },
    { id: 'trae', path: join(home, '.trae') },
    { id: 'codebuddy', path: join(home, '.codebuddy') },
    { id: 'cline', path: join(home, '.cline') },
    { id: 'roo', path: join(home, '.roo') },
    { id: 'goose', path: join(home, '.config', 'goose') },
    { id: 'codeium', path: join(home, '.codeium') },
    { id: 'opencode', path: join(home, '.local', 'share', 'opencode') },
    { id: 'continue', path: join(home, '.continue') },
    { id: 'aider', path: join(home, '.aider') },
  ]
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

function messageText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((part) => part?.type === 'text' || typeof part === 'string')
    .map((part) => (typeof part === 'string' ? part : part.text || ''))
    .join(' ')
}

function genericUserMessage(value) {
  if (!value || typeof value !== 'object') return null
  const message = value.message && typeof value.message === 'object' ? value.message : value
  const role = message.role || value.role
  const isUser = role === 'user' || value.type === 'user' || value.type === 'user_message'
  if (!isUser) return null
  const raw = messageText(message.content ?? message.text ?? value.content ?? value.text)
  const text = cleanUserInput(raw)
  if (!text || !/\p{Script=Han}/u.test(text)) return null
  return { text, timestamp: value.timestamp || value.createdAt || message.timestamp || null }
}

function walkMessages(value, output, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  const message = genericUserMessage(value)
  if (message) {
    output.push(message)
    return
  }
  if (Array.isArray(value)) value.forEach((item) => walkMessages(item, output, seen))
  else Object.values(value).forEach((item) => walkMessages(item, output, seen))
}

export function parseAgentUserInputs(content) {
  const output = []
  const source = String(content)
  try {
    walkMessages(JSON.parse(source), output)
  } catch {
    for (const line of source.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        walkMessages(JSON.parse(line), output)
      } catch {}
    }
  }
  return output
}

function isSameLocalDay(timestamp, date) {
  if (!timestamp) return true
  const parsed = new Date(timestamp)
  return Number.isFinite(parsed.getTime()) && localDayParts(parsed).join('-') === localDayParts(date).join('-')
}

async function recentHistoryFiles(root, date, { maxDepth = 7, maxFiles = 500 } = {}) {
  const files = []
  const visit = async (directory, depth) => {
    if (depth > maxDepth || files.length >= maxFiles) return
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'EACCES') return
      throw error
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) break
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path, depth + 1)
      else if (entry.isFile() && /\.(?:jsonl?|ndjson)$/i.test(entry.name)) {
        const info = await stat(path)
        if (info.size <= 5_000_000 && isSameLocalDay(info.mtime, date)) files.push(path)
      }
    }
  }
  await visit(root, 0)
  return files
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

export async function collectTodayAgentInputs({ date = new Date(), roots = agentHistoryRoots() } = {}) {
  const batches = await Promise.all(
    roots.map(async (source) => {
      if (source.id === 'codex') return collectTodayCodexInputs({ date, root: source.path })
      const files = await recentHistoryFiles(source.path, date)
      return (
        await Promise.all(
          files.map(async (file) => {
            try {
              return parseAgentUserInputs(await readFile(file, 'utf8')).filter((message) => isSameLocalDay(message.timestamp, date))
            } catch {
              return []
            }
          }),
        )
      ).flat()
    }),
  )
  const unique = new Map()
  for (const message of batches.flat().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))) {
    if (!unique.has(message.text)) unique.set(message.text, message)
  }
  return [...unique.values()]
}
