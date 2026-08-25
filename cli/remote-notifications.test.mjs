import { DEFAULT_NOTIFICATION_FEED_URL, pullRemoteNotifications, validRemoteNotifications } from './remote-notifications.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

const now = new Date('2026-08-25T12:00:00+08:00')

test('remote notification feed rejects malformed and expired messages', () => {
  const result = validRemoteNotifications(
    {
      notifications: [
        { id: 'valid', title: 'Pan', body: 'Keep going', expiresAt: '2026-08-26T12:00:00+08:00' },
        { id: 'expired', body: 'Old', expiresAt: '2026-08-24T12:00:00+08:00' },
        { id: 'empty', body: '' },
      ],
    },
    now,
  )
  assert.deepEqual(
    result.map(({ id }) => id),
    ['valid'],
  )
})

test('client displays unseen messages once and records successful delivery', async () => {
  const profile = { remoteNotifications: { seenIds: ['seen'], lastCheckedAt: null } }
  const displayed = []
  const payload = {
    notifications: [
      { id: 'seen', body: 'Already shown' },
      { id: 'new', title: 'Pan', body: 'Review ten words', expiresAt: '2026-08-26T12:00:00+08:00' },
    ],
  }
  const result = await pullRemoteNotifications({}, profile, {
    now,
    fetchImpl: async (url) => {
      assert.equal(url.origin + url.pathname, DEFAULT_NOTIFICATION_FEED_URL)
      assert.equal(url.searchParams.has('_pan'), true)
      return new Response(JSON.stringify(payload), { status: 200 })
    },
    notifyImpl: async (body, options) => {
      displayed.push({ body, title: options.title })
      return true
    },
  })
  assert.equal(result.delivered, 1)
  assert.deepEqual(displayed, [{ body: 'Review ten words', title: 'Pan' }])
  assert.deepEqual(profile.remoteNotifications.seenIds, ['seen', 'new'])
})

test('failed native notifications remain pending for retry', async () => {
  const profile = {}
  const result = await pullRemoteNotifications({}, profile, {
    now,
    fetchImpl: async () => new Response(JSON.stringify({ notifications: [{ id: 'retry', body: 'Try again' }] })),
    notifyImpl: async () => false,
  })
  assert.equal(result.delivered, 0)
  assert.deepEqual(profile.remoteNotifications.seenIds, [])
})
