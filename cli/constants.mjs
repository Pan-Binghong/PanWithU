export const APP_NAME = 'PanWithU'
export const VERSION = '0.2.0'
export const AI_BASE_URLS = ['https://www.dmxapi.cn/v1']
export const AI_BASE_URL = AI_BASE_URLS[0]
export const AI_MODEL = 'claude-sonnet-5'
export const TTS_MODEL = 'gpt-4o-mini-tts'

export const PETS = [
  ['panda', 'Momo', '🐼', 'gentle'],
  ['cat', 'Mimi', '🐱', 'curious'],
  ['dog', 'Coco', '🐶', 'cheerful'],
  ['rabbit', 'Lulu', '🐰', 'lively'],
  ['fox', 'Fifi', '🦊', 'clever'],
  ['bear', 'Bobo', '🐻', 'warm'],
  ['koala', 'Koko', '🐨', 'sleepy'],
  ['tiger', 'Toto', '🐯', 'brave'],
  ['lion', 'Leo', '🦁', 'proud'],
  ['frog', 'Pip', '🐸', 'playful'],
  ['penguin', 'Pingo', '🐧', 'steady'],
  ['owl', 'Ollie', '🦉', 'wise'],
  ['duck', 'Dudu', '🦆', 'chatty'],
  ['chick', 'Chichi', '🐥', 'bright'],
  ['hamster', 'Nono', '🐹', 'snacky'],
  ['mouse', 'Titi', '🐭', 'quick'],
  ['unicorn', 'Nova', '🦄', 'dreamy'],
  ['dragon', 'Ember', '🐲', 'bold'],
  ['robot', 'Byte', '🤖', 'logical'],
  ['alien', 'Orbit', '👽', 'odd'],
  ['octopus', 'Inky', '🐙', 'creative'],
  ['whale', 'Wavy', '🐳', 'calm'],
  ['bee', 'Buzz', '🐝', 'busy'],
  ['butterfly', 'Flutter', '🦋', 'graceful'],
  ['seedling', 'Sprout', '🌱', 'patient'],
].map(([id, name, emoji, personality]) => ({ id, name, emoji, personality }))

export const PET_ART = {
  panda: ['  ʕ•ᴥ•ʔ', '  /|   |\\', '   /   \\'],
  cat: [' /\\_/\\', '( o.o )', ' > ^ <'],
  dog: [' / __', '(    @\\___', ' /         O', '/   (_____/', '/_____/   U'],
  default: ['  /ᐠ｡ꞈ｡ᐟ\\', '  companion', '  with you'],
}
