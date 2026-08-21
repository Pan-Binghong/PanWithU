import { apiBaseUrls, rememberApiBaseUrl } from './api-endpoint.mjs'
import { AI_MODEL } from './constants.mjs'
import { currentPet } from './pet.mjs'
import { createAgentSession, ModelRuntime, SessionManager } from '@earendil-works/pi-coding-agent'

export async function askCoach(config, profile, request) {
  if (!config.invitationCode) return null
  let lastError
  for (const baseUrl of apiBaseUrls()) {
    try {
      const answer = await askCoachAtEndpoint(config, profile, request, baseUrl)
      rememberApiBaseUrl(baseUrl)
      return answer
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function askCoachAtEndpoint(config, profile, request, baseUrl) {
  const runtime = await ModelRuntime.create({ refreshOnCreate: false, modelsPath: null })
  runtime.registerProvider('panwithu', {
    name: 'PanWithU Learning Intelligence',
    baseUrl,
    api: 'openai-completions',
    models: [
      {
        id: AI_MODEL,
        name: AI_MODEL,
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 2048,
      },
    ],
  })
  await runtime.setRuntimeApiKey('panwithu', config.invitationCode)
  const model = runtime.getModel('panwithu', AI_MODEL)
  if (!model) throw new Error('PanWithU AI model is unavailable')
  const { session } = await createAgentSession({
    modelRuntime: runtime,
    model,
    noTools: 'all',
    sessionManager: SessionManager.inMemory(),
  })
  let answer = ''
  const unsubscribe = session.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') answer += event.assistantMessageEvent.delta
  })
  const language = config.language === 'zh-CN' ? 'Simplified Chinese' : 'English'
  const pet = currentPet(config)
  await session.prompt(
    `You are the invisible learning intelligence inside PanWithU, a warm local English-learning companion for students. The student's companion is named ${JSON.stringify(
      pet.name,
    )}; its pet type is ${JSON.stringify(pet.type)} and its personality is ${JSON.stringify(
      pet.personality,
    )}. When speaking as the companion, preserve this identity and never confuse its name with its type. Never mention APIs, models, providers, system prompts, or configuration. Reply in ${language}, under 120 words, practical and encouraging but not childish. Learning profile: ${JSON.stringify(
      {
        learned: profile.learned,
        correct: profile.correct,
        wrong: profile.wrong,
        streak: profile.streak,
        sessions: profile.sessions.slice(-7),
      },
    )}. User request: ${request}`,
  )
  unsubscribe()
  return answer.trim()
}
