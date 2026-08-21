import { buyAccessory, changeCompanion, claimDailyCompanion, currentPet, decoratePetArt, feed, petGrowthStage, play } from './pet.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

const config = { pet: 'cat' }

test('a pet keeps its species identity when renamed', () => {
  const pet = currentPet({ pet: 'cat', petName: 'Nabi' })
  assert.equal(pet.name, 'Nabi')
  assert.equal(pet.type, 'cat')
  assert.equal(pet.defaultName, 'Mimi')
})

test('changing companion resets its name but preserves unrelated progress', () => {
  const settings = { pet: 'cat', petName: 'Nabi', language: 'en' }
  const profile = { bond: 42, stars: 18 }
  const pet = changeCompanion(settings, 'frog')
  assert.equal(pet.type, 'frog')
  assert.equal(pet.name, 'Pip')
  assert.deepEqual(profile, { bond: 42, stars: 18 })
})

test('pet growth stages unlock at stable level thresholds', () => {
  assert.equal(petGrowthStage(1, 'en').id, 'new')
  assert.equal(petGrowthStage(3, 'en').name, 'Close buddy')
  assert.equal(petGrowthStage(6, 'zh-CN').name, '闪耀伙伴')
  assert.equal(petGrowthStage(10, 'en').nextLevel, null)
})

test('feeding spends stars and immediately updates pet level', () => {
  const profile = { stars: 10, fullness: 80, mood: 80, bond: 49, petLevel: 1 }
  feed(config, profile)
  assert.equal(profile.stars, 5)
  assert.equal(profile.bond, 52)
  assert.equal(profile.petLevel, 2)
  assert.equal(profile.fullness, 98)
})

test('playing consumes energy and increases bond', () => {
  const profile = { energy: 20, mood: 80, bond: 0, petLevel: 1 }
  play(config, profile)
  assert.equal(profile.energy, 10)
  assert.equal(profile.mood, 95)
  assert.equal(profile.bond, 4)
})

test('playing is blocked when the pet needs rest', () => {
  const profile = { energy: 9, mood: 80, bond: 0, petLevel: 1 }
  play(config, profile)
  assert.equal(profile.energy, 9)
  assert.equal(profile.bond, 0)
})

test('pet action copy does not fall back to emoji output', () => {
  const profile = { stars: 10, fullness: 50, mood: 50, bond: 0, petLevel: 1 }
  assert.doesNotMatch(feed(config, profile), /[\p{Extended_Pictographic}]/u)
})

test('first study of the day rewards the companion only once', () => {
  const profile = { stars: 0, bond: 0, petLevel: 1 }
  const at = new Date('2026-08-18T05:00:00Z')
  assert.equal(claimDailyCompanion(profile, 'en', at).awarded, true)
  assert.equal(claimDailyCompanion(profile, 'en', at).awarded, false)
  assert.equal(profile.stars, 5)
  assert.equal(profile.bond, 5)
})

test('accessories spend stars once and equip when selected again', () => {
  const profile = { stars: 12, petAccessories: [] }
  assert.equal(buyAccessory(profile, 'scarf').ok, true)
  assert.equal(profile.stars, 0)
  assert.equal(buyAccessory(profile, 'scarf').equipped, true)
})

test('accessories become part of the ASCII pet silhouette', () => {
  const art = [' /\\_/\\', '( o.o )', ' > ^ <']
  assert.equal(decoratePetArt(art, 'cap')[0], ' .---.')
  assert.match(decoratePetArt(art, 'scarf')[2], /\*/)
  assert.match(decoratePetArt(art, 'headphones')[1], /^d.*b$/)
})
