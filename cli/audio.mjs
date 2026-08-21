import { apiBaseUrls, rememberApiBaseUrl } from './api-endpoint.mjs'
import { TTS_MODEL } from './constants.mjs'
import { paths } from './storage.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const inFlight = new Map()
const commandAvailability = new Map()
const singleWordPattern = /^[A-Za-z]+(?:['-][A-Za-z]+)*$/
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const defaultKeySound = join(root, 'public', 'sounds', 'key-sound', 'Default.wav')
const correctSound = join(root, 'public', 'sounds', 'correct.wav')
const wrongSound = join(root, 'public', 'sounds', 'beep.wav')
let lastKeySoundAt = 0

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function commandExists(command) {
  if (commandAvailability.has(command)) return commandAvailability.get(command)
  const locator = process.platform === 'win32' ? 'where' : 'which'
  const exists = spawnSync(locator, [command], { stdio: 'ignore' }).status === 0
  commandAvailability.set(command, exists)
  return exists
}

function runDetached(command, args) {
  try {
    const child = spawn(command, args, { detached: process.platform !== 'win32', stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
    return true
  } catch {
    return false
  }
}

export function audioPlayerForPlatform(file, platform = process.platform) {
  if (platform === 'darwin') return ['afplay', [file]]
  if (platform === 'win32') {
    const safeFile = file.replaceAll("'", "''")
    const script = `$player = New-Object -ComObject WMPlayer.OCX; $media = $player.newMedia('${safeFile}'); $player.currentMedia = $media; $player.controls.play(); while ($player.playState -ne 1) { Start-Sleep -Milliseconds 100 }`
    return ['powershell', ['-NoProfile', '-NonInteractive', '-Command', script]]
  }
  if (file.toLowerCase().endsWith('.wav') && commandExists('paplay')) return ['paplay', [file]]
  if (commandExists('ffplay')) return ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', file]]
  if (commandExists('mpg123')) return ['mpg123', ['-q', file]]
  return null
}

export function playFile(file) {
  const player = audioPlayerForPlatform(file)
  return player ? runDetached(player[0], player[1]) : false
}

export function playKeySound(now = Date.now()) {
  // A detached player is started for each key. Limit bursts so fast typing does
  // not create an audio-process backlog while keeping the keyboard responsive.
  if (now - lastKeySoundAt < 35) return false
  lastKeySoundAt = now
  return playFile(defaultKeySound)
}

export function feedbackSoundFile(isCorrect) {
  return isCorrect ? correctSound : wrongSound
}

export function playFeedbackSound(isCorrect) {
  return playFile(feedbackSoundFile(isCorrect))
}

export function systemSpeechCommand(text, { accent = 'us', slow = false } = {}, platform = process.platform) {
  if (platform === 'darwin') return ['say', ['-v', accent === 'uk' ? 'Daniel' : 'Samantha', '-r', slow ? '125' : '175', text]]
  if (platform === 'win32') {
    const safeText = text.replaceAll("'", "''")
    const rate = slow ? -3 : 0
    return [
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = ${rate}; $s.Speak('${safeText}')`,
      ],
    ]
  }
  if (commandExists('spd-say')) return ['spd-say', ['-l', accent === 'uk' ? 'en-GB' : 'en-US', '-r', slow ? '-35' : '0', text]]
  if (commandExists('espeak')) return ['espeak', ['-v', accent === 'uk' ? 'en-gb' : 'en-us', '-s', slow ? '125' : '175', text]]
  return null
}

export function speakWithSystem(text, options) {
  const command = systemSpeechCommand(text, options)
  return command ? runDetached(command[0], command[1]) : false
}

async function cachedFile(cacheKey) {
  const file = join(paths.audio, `${hash(cacheKey)}.mp3`)
  try {
    await access(file)
    return file
  } catch {
    return null
  }
}

async function saveAudio(cacheKey, bytes) {
  await mkdir(paths.audio, { recursive: true, mode: 0o700 })
  const file = join(paths.audio, `${hash(cacheKey)}.mp3`)
  await writeFile(file, bytes, { mode: 0o600 })
  return file
}

async function fetchDictionaryAudio(text, accent, fetchImpl) {
  if (!singleWordPattern.test(text)) return null
  const cacheKey = `dictionary|${accent}|${text.toLowerCase()}`
  const cached = await cachedFile(cacheKey)
  if (cached) return { file: cached, source: 'dictionary-cache' }
  const type = accent === 'uk' ? 1 : 2
  const response = await fetchImpl(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`, {
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 256) return null
  return { file: await saveAudio(cacheKey, bytes), source: 'dictionary' }
}

async function fetchGeneratedAudio(text, config, { accent, slow }, fetchImpl) {
  if (!config.invitationCode) return null
  const voice = accent === 'uk' ? 'fable' : 'alloy'
  const cacheKey = `tts|${TTS_MODEL}|${voice}|${slow ? 'slow' : 'normal'}|${text}`
  const cached = await cachedFile(cacheKey)
  if (cached) return { file: cached, source: 'tts-cache' }
  for (const baseUrl of apiBaseUrls()) {
    try {
      const response = await fetchImpl(`${baseUrl}/audio/speech`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.invitationCode}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: TTS_MODEL, input: text, voice, speed: slow ? 0.75 : 1 }),
        signal: AbortSignal.timeout(12_000),
      })
      if (!response.ok) continue
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length < 256) continue
      rememberApiBaseUrl(baseUrl)
      return { file: await saveAudio(cacheKey, bytes), source: 'tts' }
    } catch {}
  }
  return null
}

export async function resolveAudio(text, config, options = {}, fetchImpl = fetch) {
  const normalized = text.trim()
  if (!normalized) return null
  const accent = options.accent === 'uk' ? 'uk' : 'us'
  const slow = Boolean(options.slow)
  const requestKey = `${normalized}|${accent}|${slow}`
  if (inFlight.has(requestKey)) return inFlight.get(requestKey)
  const request = (async () => {
    try {
      const dictionaryAudio = await fetchDictionaryAudio(normalized, accent, fetchImpl)
      if (dictionaryAudio) return dictionaryAudio
    } catch {}
    try {
      return await fetchGeneratedAudio(normalized, config, { accent, slow }, fetchImpl)
    } catch {
      return null
    }
  })().finally(() => inFlight.delete(requestKey))
  inFlight.set(requestKey, request)
  return request
}

export async function speak(text, config, options = {}) {
  const audio = await resolveAudio(text, config, options)
  if (audio && playFile(audio.file)) return { played: true, source: audio.source }
  return { played: speakWithSystem(text, options), source: 'system' }
}
