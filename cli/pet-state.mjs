export const PET_STATES = {
  idle: { frames: ['●', '◉'], zh: '清醒', en: 'awake' },
  calm: { frames: ['○', '◌'], zh: '安静陪伴', en: 'staying close' },
  focus: { frames: ['◆', '◇'], zh: '专注', en: 'focused' },
  thinking: { frames: ['◐', '◑'], zh: '思考中', en: 'thinking' },
  feed: { frames: ['◒', '◓'], zh: '吃点心', en: 'having a snack' },
  play: { frames: ['↗', '↘'], zh: '玩耍中', en: 'playing' },
  cheer: { frames: ['✦', '✧'], zh: '为你加油', en: 'cheering' },
  celebrate: { frames: ['✺', '✹'], zh: '庆祝连击', en: 'celebrating' },
  comfort: { frames: ['♡', '♥'], zh: '关心你', en: 'caring' },
  sleep: { frames: ['ᶻ', 'ᶻᶻ'], zh: '睡着了', en: 'sleeping' },
  tired: { frames: ['◔', '◕'], zh: '有点困', en: 'tired' },
  hungry: { frames: ['◍', '◎'], zh: '有点饿', en: 'hungry' },
  calling: { frames: ['!', '!!'], zh: '正在呼唤你', en: 'calling you' },
  quiz: { frames: ['?', '¿'], zh: '突击考察', en: 'surprise quiz' },
  story: { frames: ['≋', '≋≋'], zh: '讲个故事', en: 'telling a story' },
}

export function petStateView(activity = 'idle', frame = 0, language = 'zh-CN') {
  const state = PET_STATES[activity]
  if (!state) throw new Error(`Unknown pet state: ${activity}`)
  return {
    id: activity,
    symbol: state.frames[Math.abs(Number(frame) || 0) % state.frames.length],
    label: language === 'en' ? state.en : state.zh,
  }
}

export function ambientPetState(profile = {}) {
  if (profile.companionAgent?.pendingEvent) return 'calling'
  if (Number(profile.energy) < 25) return 'tired'
  if (Number(profile.fullness) < 30) return 'hungry'
  if (Number(profile.mood) < 35) return 'comfort'
  return 'idle'
}
