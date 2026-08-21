import { dailyPetGreeting, updateDailyUserProfile } from './user-profile.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('updates the simple user profile only once per local day', () => {
  const profile = {
    sessions: [
      { count: 10, correct: 8 },
      { count: 20, correct: 18 },
    ],
  }
  const config = { practiceMode: 'hideVowel' }
  assert.equal(updateDailyUserProfile(profile, config, new Date(2026, 7, 21, 19)), true)
  assert.equal(updateDailyUserProfile(profile, config, new Date(2026, 7, 21, 20)), false)
  assert.equal(profile.userProfile.activeDays, 1)
  assert.equal(profile.userProfile.usualTime, 'evening')
  assert.equal(profile.userProfile.preferredPracticeMode, 'hideVowel')
  assert.equal(profile.userProfile.recentAccuracy, 87)
  assert.equal(profile.userProfile.averageSessionWords, 15)
})

test('pet greeting uses the stored user name and usual time', () => {
  const profile = { userProfile: { name: 'Pan', usualTime: 'evening' } }
  assert.match(dailyPetGreeting(profile, 'zh-CN'), /^晚上好，Pan/)
  assert.match(dailyPetGreeting(profile, 'en'), /^Good evening, Pan/)
})
