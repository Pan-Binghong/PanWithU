import { systemUsername } from './identity.mjs'

function localDay(now) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timePeriod(hour) {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function usualPeriod(hours) {
  const counts = { morning: 0, afternoon: 0, evening: 0 }
  for (const hour of hours) counts[timePeriod(hour)] += 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export function updateDailyUserProfile(profile, config, now = new Date()) {
  const day = localDay(now)
  profile.userProfile ||= {}
  if (profile.userProfile.updatedDay === day) return false

  const recentSessions = (profile.sessions || []).slice(-7)
  const attempted = recentSessions.reduce((sum, session) => sum + Number(session.count || 0), 0)
  const correct = recentSessions.reduce((sum, session) => sum + Number(session.correct || 0), 0)
  const visitHours = [...(profile.userProfile.visitHours || []), now.getHours()].slice(-14)
  profile.userProfile = {
    name: systemUsername() || profile.userProfile.name || null,
    firstSeenAt: profile.userProfile.firstSeenAt || now.toISOString(),
    updatedDay: day,
    activeDays: Number(profile.userProfile.activeDays || 0) + 1,
    visitHours,
    usualTime: usualPeriod(visitHours),
    preferredPracticeMode: config.practiceMode || 'learn',
    recentSessions: recentSessions.length,
    recentAccuracy: attempted ? Math.round((correct / attempted) * 100) : null,
    averageSessionWords: recentSessions.length ? Math.round(attempted / recentSessions.length) : 0,
  }
  return true
}

export function dailyPetGreeting(profile, language = 'zh-CN') {
  const user = profile.userProfile || {}
  const period = user.usualTime || 'morning'
  if (language === 'en') {
    const greeting = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }[period]
    return `${greeting}${user.name ? `, ${user.name}` : ''}. I’m here whenever you’re ready.`
  }
  const greeting = { morning: '早上好', afternoon: '下午好', evening: '晚上好' }[period]
  return `${greeting}${user.name ? `，${user.name}` : ''}。我在这里，准备好了我们就开始。`
}
