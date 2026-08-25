import { notify } from './reminder.mjs'

export const DEFAULT_NOTIFICATION_FEED_URL = 'https://pan-binghong.github.io/panwithu-notifications/notifications.json'

export function validRemoteNotifications(payload, now = new Date()) {
  if (!Array.isArray(payload?.notifications)) return []
  const nowTime = now.getTime()
  return payload.notifications
    .filter((item) => {
      if (!item || typeof item.id !== 'string' || !item.id.trim()) return false
      if (typeof item.body !== 'string' || !item.body.trim()) return false
      const expiresAt = item.expiresAt ? new Date(item.expiresAt).getTime() : Infinity
      return Number.isFinite(expiresAt) ? expiresAt > nowTime : item.expiresAt == null
    })
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
}

export async function pullRemoteNotifications(
  config,
  profile,
  { fetchImpl = fetch, notifyImpl = notify, now = new Date(), maxPerPull = 3 } = {},
) {
  profile.remoteNotifications ||= { seenIds: [], lastCheckedAt: null }
  const state = profile.remoteNotifications
  const feedUrl = config.notificationFeedUrl || DEFAULT_NOTIFICATION_FEED_URL
  let response
  try {
    const url = new URL(feedUrl)
    url.searchParams.set('_pan', String(now.getTime()))
    response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } })
  } catch {
    return { checked: false, delivered: 0, reason: 'network' }
  }
  if (!response.ok) return { checked: false, delivered: 0, reason: `http-${response.status}` }
  let payload
  try {
    payload = await response.json()
  } catch {
    return { checked: false, delivered: 0, reason: 'invalid-json' }
  }
  const seen = new Set(state.seenIds || [])
  const pending = validRemoteNotifications(payload, now)
    .filter((item) => !seen.has(item.id))
    .slice(0, maxPerPull)
  let delivered = 0
  for (const item of pending) {
    const success = await notifyImpl(item.body.trim(), { title: String(item.title || 'Pan').trim() || 'Pan' })
    if (!success) continue
    seen.add(item.id)
    delivered += 1
  }
  state.seenIds = [...seen].slice(-200)
  state.lastCheckedAt = now.toISOString()
  return { checked: true, delivered, reason: pending.length ? 'processed' : 'no-new-messages' }
}
