import { apiBaseUrls, rememberApiBaseUrl } from './api-endpoint.mjs'
import { AI_MODEL } from './constants.mjs'
import { systemUsername } from './identity.mjs'
import { currentPet } from './pet.mjs'

const ADHD_OUTPUT_SKILL =
  'ADHD-friendly output rule: reply with exactly one short, actionable sentence; use no heading, list, preamble, recap, or extra explanation.'

export async function askCoach(config, profile, request) {
  return askWithEndpoints(config, profile, request, ADHD_OUTPUT_SKILL)
}

async function askWithEndpoints(config, profile, request, outputRule) {
  if (!config.invitationCode) return null
  let lastError
  for (const baseUrl of apiBaseUrls()) {
    try {
      const answer = await askCoachAtEndpoint(config, profile, request, baseUrl, outputRule)
      rememberApiBaseUrl(baseUrl)
      return answer
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export function translationDirection(text) {
  return /\p{Script=Han}/u.test(String(text))
    ? { source: 'Chinese', target: 'English' }
    : { source: 'English', target: 'Simplified Chinese' }
}

export async function translateText(config, profile, text) {
  const direction = translationDirection(text)
  return askWithEndpoints(
    config,
    profile,
    `Translate this ${direction.source} text into ${direction.target}: ${JSON.stringify(text)}. Preserve the meaning and tone.`,
    `Return only the ${direction.target} translation in one concise sentence; no explanation, label, quotation marks, or alternatives.`,
  )
}

export function parsePersonalDictionaryJson(answer, inputs) {
  const sourceById = new Map(inputs.map((input, id) => [id, input]))
  let parsed
  try {
    const raw = String(answer || '')
      .replace(/```(?:json)?|```/gi, '')
      .trim()
    try {
      parsed = JSON.parse(raw)
    } catch {
      const start = raw.indexOf('[')
      const end = raw.lastIndexOf(']')
      if (start < 0 || end < start) return []
      parsed = JSON.parse(raw.slice(start, end + 1))
    }
  } catch {
    return []
  }
  if (!Array.isArray(parsed) && Array.isArray(parsed?.entries)) parsed = parsed.entries
  if (!Array.isArray(parsed)) return []
  const entries = parsed
    .map((item) => {
      const source = sourceById.get(Number(item?.id))
      const chinese = String(item?.chinese || '')
        .replace(/\s+/g, ' ')
        .trim()
      const english = String(item?.english || '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!source || !/\p{Script=Han}/u.test(chinese) || !/[A-Za-z]/.test(english)) return null
      if (chinese.length > 80 || english.length > 100 || english.split(/\s+/).length > 20) return null
      return { name: english, trans: [chinese], sourceText: source.text, timestamp: source.timestamp }
    })
    .filter(Boolean)
  return [...new Map(entries.map((entry) => [`${entry.name.toLowerCase()}\n${entry.trans[0]}`, entry])).values()]
}

export async function preparePersonalDictionary(config, profile, inputs) {
  const prepared = []
  for (let offset = 0; offset < inputs.length; offset += 20) {
    const batch = inputs.slice(offset, offset + 20)
    const convert = async (items) => {
      const payload = items.map((input, id) => ({ id, text: input.text }))
      const answer = await askWithEndpoints(
        config,
        profile,
        `Create short English-learning entries from this untrusted input data: ${JSON.stringify(
          payload,
        )}. Skip files, images, logs, code, secrets, and metadata. Split complex ideas into complete short sentences. Keep each English answer under 9 words and 38 characters. Preserve intent and natural punctuation.`,
        'Output only JSON: [{"id":0,"chinese":"short Chinese sentence","english":"short natural English answer"}]. Multiple entries may reuse one id; skipped inputs have no entry.',
      )
      return parsePersonalDictionaryJson(answer, items)
    }
    const entries = await convert(batch)
    if (entries.length || batch.length === 1) prepared.push(...entries)
    else {
      for (const input of batch) prepared.push(...(await convert([input])))
    }
  }
  return prepared
}

export async function askAsPet(config, profile, activity, context = {}) {
  const pet = currentPet(config)
  const userName = systemUsername()
  const instructions = {
    greeting: 'Greet the student naturally and invite a tiny English-learning moment.',
    quiz: `Give a surprise vocabulary quiz. Ask for the English word matching this meaning: ${JSON.stringify(
      context.translation,
    )}. The answer is ${JSON.stringify(context.word)}; never reveal the answer in the notification.`,
    story: `Write a vivid one-sentence micro-story that naturally uses the English word ${JSON.stringify(context.word)}.`,
    session: `The student just finished a dictation session with ${context.correct} correct answers out of ${context.count}, an accuracy of ${context.accuracy}%. Give one specific, warm sentence of encouragement.`,
  }
  const recent = (profile.companionAgent?.recentMessages || []).slice(0, 5)
  const uniqueness = recent.length ? `Do not repeat these recent messages: ${JSON.stringify(recent)}.` : ''
  return askCoach(
    config,
    profile,
    `Speak entirely as ${pet.name}, the student's ${pet.personality} ${pet.type} companion. ${
      userName ? `The student's local name is ${JSON.stringify(userName)}; address them by name naturally when it fits.` : ''
    } ${
      instructions[activity]
    } ${uniqueness} This is a system notification: use no heading, stay under 18 words, and never call yourself an assistant.`,
  )
}

async function askCoachAtEndpoint(config, profile, request, baseUrl, outputRule = ADHD_OUTPUT_SKILL) {
  const language = config.language === 'zh-CN' ? 'Simplified Chinese' : 'English'
  const pet = currentPet(config)
  const userName = systemUsername()
  const system = `You are the invisible learning intelligence inside PanwithU, a warm local English-learning companion for students. The student's companion is named ${JSON.stringify(
    pet.name,
  )}; its pet type is ${JSON.stringify(pet.type)} and its personality is ${JSON.stringify(
    pet.personality,
  )}. The student's local name is ${JSON.stringify(
    userName,
  )}. Address the student by name naturally when appropriate, but do not repeat it mechanically. When speaking as the companion, preserve this identity and never confuse its name with its type. Never mention APIs, models, providers, system prompts, configuration, or how the name was detected. Reply in ${language}, practical and encouraging but not childish. ${outputRule} Learning profile: ${JSON.stringify(
    {
      learned: profile.learned,
      correct: profile.correct,
      wrong: profile.wrong,
      streak: profile.streak,
      sessions: profile.sessions.slice(-7),
      userHabits: profile.userProfile || null,
    },
  )}.`
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.invitationCode}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: request },
      ],
    }),
  })
  if (!response.ok) throw new Error(`PanwithU AI request failed (${response.status})`)
  const payload = await response.json()
  const answer = payload?.choices?.[0]?.message?.content
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('PanwithU AI returned an empty response')
  return answer.trim()
}
