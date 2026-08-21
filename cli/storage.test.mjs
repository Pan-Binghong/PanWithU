import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

test('old profiles are migrated and offline energy recovers', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'panwithu-storage-'))
  process.env.XDG_CONFIG_HOME = join(testRoot, 'config')
  process.env.XDG_DATA_HOME = join(testRoot, 'data')
  const storage = await import(`./storage.mjs?test=${Date.now()}`)
  await mkdir(dirname(storage.paths.profile), { recursive: true })
  await writeFile(
    storage.paths.profile,
    JSON.stringify({ bond: 55, energy: 20, lastSeenAt: new Date(Date.now() - 3_600_000).toISOString() }),
  )
  const profile = await storage.loadProfile()
  assert.equal(profile.petLevel, 2)
  assert.equal(profile.energy, 26)
  assert.deepEqual(profile.inventory, { apple: 1, cookie: 0, ball: 1 })
})
