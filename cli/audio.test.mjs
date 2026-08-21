import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const testRoot = await mkdtemp(join(tmpdir(), 'panwithu-audio-'))
process.env.XDG_CONFIG_HOME = join(testRoot, 'config')
process.env.XDG_DATA_HOME = join(testRoot, 'data')

const { audioPlayerForPlatform, feedbackSoundFile, playKeySound, resolveAudio, systemSpeechCommand } = await import('./audio.mjs')

const audioResponse = () => new Response(Buffer.alloc(512, 1), { status: 200, headers: { 'content-type': 'audio/mpeg' } })

test('single words prefer dictionary pronunciation and use the cache', async () => {
  let requests = 0
  const fetchMock = async (url) => {
    requests += 1
    assert.match(String(url), /dict\.youdao\.com/)
    return audioResponse()
  }
  const first = await resolveAudio('companion', { invitationCode: 'unused' }, { accent: 'uk' }, fetchMock)
  const second = await resolveAudio('companion', { invitationCode: 'unused' }, { accent: 'uk' }, fetchMock)
  assert.equal(first.source, 'dictionary')
  assert.equal(second.source, 'dictionary-cache')
  assert.equal(requests, 1)
})

test('phrases and sentences use generated TTS when an invitation code exists', async () => {
  let request
  const fetchMock = async (url, options) => {
    request = { url: String(url), options }
    return audioResponse()
  }
  const result = await resolveAudio('grow together', { invitationCode: 'test-key' }, { accent: 'us' }, fetchMock)
  assert.equal(result.source, 'tts')
  assert.equal(request.url, 'https://www.dmxapi.cn/v1/audio/speech')
  assert.equal(request.options.headers.Authorization, 'Bearer test-key')
  assert.equal(JSON.parse(request.options.body).input, 'grow together')
})

test('phrases without an invitation code fall through to system speech', async () => {
  const result = await resolveAudio('learn with me', { invitationCode: '' }, {}, async () => {
    throw new Error('network should not be used')
  })
  assert.equal(result, null)
})

test('platform commands support MP3 playback and system speech', () => {
  assert.equal(audioPlayerForPlatform('/tmp/a.mp3', 'darwin')[0], 'afplay')
  assert.match(audioPlayerForPlatform('C:\\audio.mp3', 'win32')[1].join(' '), /WMPlayer\.OCX/)
  assert.equal(systemSpeechCommand('hello', {}, 'darwin')[0], 'say')
  assert.match(systemSpeechCommand("it's ready", {}, 'win32')[1].join(' '), /System\.Speech/)
})

test('keyboard sound is rate-limited during fast typing', () => {
  assert.equal(playKeySound(1_000), true)
  assert.equal(playKeySound(1_020), false)
})

test('correct and incorrect answers use different bundled feedback sounds', () => {
  assert.match(feedbackSoundFile(true), /correct\.wav$/)
  assert.match(feedbackSoundFile(false), /beep\.wav$/)
})
