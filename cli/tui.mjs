import { playFeedbackSound, playKeySound, speak } from './audio.mjs'
import { PETS } from './constants.mjs'
import { loadChapter, loadDictionaryCatalog } from './dictionary.mjs'
import { updateWordMemory } from './learning.mjs'
import {
  PET_ACCESSORIES,
  buyAccessory,
  changeCompanion,
  claimDailyCompanion,
  currentPet,
  decoratePetArt,
  feed,
  petGrowthStage,
  play,
} from './pet.mjs'
import { dueWordCount } from './todo.mjs'
import {
  Container,
  CURSOR_MARKER,
  Editor,
  Input,
  matchesKey,
  ProcessTerminal,
  SelectList,
  Text,
  truncateToWidth,
  TuiAltScreen,
  visibleWidth,
} from '@earendil-works/pi-tui'
import { decodePrintableKey } from '@earendil-works/pi-tui/dist/keys.js'

const ansi = (code) => (value) => `\x1b[${code}m${value}\x1b[0m`
export const COLOR_THEMES = {
  violet: { name: 'Violet', primary: '38;5;141', accent: '38;5;45', success: '38;5;84', warning: '38;5;220', danger: '38;5;203' },
  ocean: { name: 'Ocean', primary: '38;5;75', accent: '38;5;81', success: '38;5;48', warning: '38;5;221', danger: '38;5;204' },
  mint: { name: 'Mint', primary: '38;5;79', accent: '38;5;121', success: '38;5;84', warning: '38;5;222', danger: '38;5;210' },
  amber: { name: 'Amber', primary: '38;5;215', accent: '38;5;221', success: '38;5;114', warning: '38;5;229', danger: '38;5;203' },
  rose: { name: 'Rose', primary: '38;5;204', accent: '38;5;213', success: '38;5;121', warning: '38;5;222', danger: '38;5;196' },
  mono: { name: 'Mono', primary: '38;5;252', accent: '38;5;255', success: '38;5;250', warning: '38;5;255', danger: '38;5;245' },
  pan: { name: 'Pan', rainbow: true, primary: '38;5;201', accent: '38;5;51', success: '38;5;46', warning: '38;5;226', danger: '38;5;196' },
}
let activeColorTheme = COLOR_THEMES.violet
const rainbowCodes = ['38;5;196', '38;5;208', '38;5;226', '38;5;46', '38;5;51', '38;5;27', '38;5;201']

function rainbowText(value, offset = 0) {
  if (String(value).includes('\x1b[')) return String(value)
  let colorIndex = offset
  return [...String(value)]
    .map((character) => {
      if (/\s/.test(character)) return character
      const painted = ansi(rainbowCodes[colorIndex % rainbowCodes.length])(character)
      colorIndex += 1
      return painted
    })
    .join('')
}

export function setColorTheme(id) {
  activeColorTheme = COLOR_THEMES[id] || COLOR_THEMES.violet
  return COLOR_THEMES[id] ? id : 'violet'
}

const c = {
  cyan: (value) => (activeColorTheme.rainbow ? rainbowText(value, 4) : ansi(activeColorTheme.accent)(value)),
  purple: (value) => (activeColorTheme.rainbow ? rainbowText(value) : ansi(activeColorTheme.primary)(value)),
  green: (value) => ansi(activeColorTheme.success)(value),
  yellow: (value) => ansi(activeColorTheme.warning)(value),
  red: (value) => ansi(activeColorTheme.danger)(value),
  dim: ansi('2'),
  bold: ansi('1'),
}
const selectTheme = {
  selectedPrefix: (s) => c.cyan(s),
  selectedText: (s) => c.bold(c.cyan(s)),
  description: (s) => c.dim(s),
  scrollInfo: (s) => c.dim(s),
  noMatch: (s) => c.red(s),
}
const editorTheme = { borderColor: (s) => c.purple(s), selectList: selectTheme }
const modeCopy = {
  'zh-CN': {
    learn: ['学习', '学习模式 · 显示单词并跟打'],
    hideAll: ['全隐藏默写', '默写 · 隐藏全部字母'],
    hideVowel: ['元音默写', '默写 · 隐藏元音'],
    hideConsonant: ['辅音默写', '默写 · 隐藏辅音'],
    randomHide: ['随机默写', '默写 · 随机隐藏'],
  },
  en: {
    learn: ['Learn', 'Learning · Show and type the word'],
    hideAll: ['Full dictation', 'Dictation · Hide every letter'],
    hideVowel: ['Vowel dictation', 'Dictation · Hide vowels'],
    hideConsonant: ['Consonant dictation', 'Dictation · Hide consonants'],
    randomHide: ['Random dictation', 'Dictation · Hide random letters'],
  },
}

export function buddyMessages(language) {
  if (language === 'zh-CN')
    return {
      start: '我在这里，慢慢来。',
      correct: '答对啦！',
      wrong: '没关系，下一个。',
      streak: ['连续答对，太稳啦！', '好厉害，继续保持！', '我们配合得真棒！'],
      label: '伙伴',
    }
  return {
    start: 'I’m right here.',
    correct: 'That’s right!',
    wrong: 'That’s okay. Next one!',
    streak: ['Great streak!', 'You’re on a roll!', 'We make a great team!'],
    label: 'Buddy',
  }
}

export function printableKey(data) {
  return decodePrintableKey(data) ?? (/^[\x20-\x7E]$/.test(data) ? data : undefined)
}

export function answerPreview(target, typed, mode = 'learn') {
  return [...target]
    .map((letter, index) => {
      if (index < typed.length) return typed[index]
      return mode === 'learn' ? letter : '·'
    })
    .join('')
}

class SecretInput {
  focused = false
  constructor() {
    this.input = new Input()
  }
  getValue() {
    return this.input.getValue()
  }
  set onSubmit(handler) {
    this.input.onSubmit = handler
  }
  set onEscape(handler) {
    this.input.onEscape = handler
  }
  handleInput(data) {
    this.input.handleInput(data)
  }
  invalidate() {
    this.input.invalidate()
  }
  render(width) {
    const hidden = '•'.repeat(this.input.getValue().length)
    return [`  ${hidden}${this.focused ? CURSOR_MARKER : ''}`.slice(0, Math.max(1, width))]
  }
}

class CommandPalette {
  focused = false
  constructor(commands, theme, onRun, onCancel, onExpand) {
    this.commands = commands
    this.onRun = onRun
    this.onCancel = onCancel
    this.onExpand = onExpand
    this.query = ''
    this.list = new SelectList(this.items(), 10, theme)
    this.list.onSelect = ({ value }) => this.onRun(`/${value}`)
    this.list.onCancel = onCancel
  }
  items() {
    return this.commands.map((item) => ({ value: item.name, label: `/${item.name}`, description: item.description }))
  }
  refresh() {
    this.list.setFilter(this.query)
  }
  invalidate() {
    this.list.invalidate()
  }
  render(width) {
    return [`  ${c.purple('/')}${c.bold(this.query)}${c.yellow('▌')}`, '', ...this.list.render(width)]
  }
  handleInput(data) {
    if (matchesKey(data, 'escape')) return this.onCancel()
    if (matchesKey(data, 'backspace')) {
      this.query = this.query.slice(0, -1)
      this.refresh()
      return
    }
    if (matchesKey(data, 'space')) return this.onExpand(`/${this.query} `)
    const printable = printableKey(data)
    if (printable && /^[A-Za-z-]$/.test(printable)) {
      this.query += printable.toLowerCase()
      this.refresh()
      return
    }
    this.list.handleInput(data)
  }
}

class Frame {
  constructor(title, child, maxWidth = 76) {
    this.title = title
    this.child = child
    this.maxWidth = maxWidth
  }
  invalidate() {
    this.child.invalidate()
  }
  render(width) {
    const boxWidth = Math.max(28, Math.min(this.maxWidth, width - 4))
    const inner = boxWidth - 2
    const title = ` ${this.title} `
    const top = `╭─${title}${'─'.repeat(Math.max(0, inner - visibleWidth(title) - 1))}╮`
    const body = this.child.render(inner).map((line) => {
      const clipped = truncateToWidth(line, inner)
      return `│${clipped}${' '.repeat(Math.max(0, inner - visibleWidth(clipped)))}│`
    })
    return ['', c.purple(`  ${top}`), ...body.map((line) => `  ${line}`), c.purple(`  ╰${'─'.repeat(inner)}╯`)]
  }
}

export async function runTuiSetup() {
  const terminal = new ProcessTerminal()
  const tui = new TuiAltScreen(terminal, true)
  const root = new Container()
  tui.addChild(root)
  const result = {
    language: 'zh-CN',
    accent: 'us',
    colorTheme: 'violet',
    invitationCode: '',
    pet: PETS[0].id,
    reminders: true,
    createdAt: new Date().toISOString(),
  }
  let resolveDone
  const done = new Promise((resolve) => {
    resolveDone = resolve
  })
  const title = (value) => new Text(`\n${c.bold(c.purple('  PanwithU'))}\n\n${c.cyan(`  ${value}`)}\n`)
  const stop = (value) => {
    tui.stop()
    resolveDone(value)
  }
  const select = (heading, items, next) => {
    const list = new SelectList(items, 12, selectTheme)
    root.clear()
    root.addChild(title(heading))
    root.addChild(list)
    root.addChild(new Text(c.dim(result.language === 'en' ? '\n  ↑↓ select · Enter confirm' : '\n  ↑↓ 选择 · Enter 确认')))
    list.onSelect = next
    tui.setFocus(list)
    tui.requestRender(true)
  }
  const petStep = () =>
    select(
      result.language === 'zh-CN' ? '选择陪伴你的宠物' : 'Choose your companion',
      PETS.map((pet) => ({ value: pet.id, label: pet.name, description: pet.id })),
      ({ value }) => {
        const pet = PETS.find((item) => item.id === value) || PETS[0]
        result.pet = pet.id
        result.petName = pet.name
        stop(result)
      },
    )
  const inviteStep = () => {
    const editor = new SecretInput()
    root.clear()
    root.addChild(title(result.language === 'zh-CN' ? '输入邀请码（可留空）' : 'Invitation code (optional)'))
    root.addChild(
      new Text(
        c.dim(
          result.language === 'en' ? '  Saved only on this device. Press Enter to continue.\n' : '  邀请码仅保存在本机，按 Enter 继续。\n',
        ),
      ),
    )
    root.addChild(editor)
    editor.onSubmit = (value) => {
      result.invitationCode = value.trim()
      petStep()
    }
    tui.setFocus(editor)
    tui.requestRender(true)
  }
  const accentStep = () =>
    select(
      result.language === 'zh-CN' ? '选择英语发音' : 'Choose English pronunciation',
      [
        { value: 'us', label: result.language === 'zh-CN' ? '美式英语' : 'American English' },
        { value: 'uk', label: result.language === 'zh-CN' ? '英式英语' : 'British English' },
      ],
      ({ value }) => {
        result.accent = value
        inviteStep()
      },
    )
  select(
    '选择系统语言 / Choose system language',
    [
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en', label: 'English' },
    ],
    ({ value }) => {
      result.language = value
      accentStep()
    },
  )
  tui.addInputListener((data) => {
    if (matchesKey(data, 'ctrl+c')) {
      stop(null)
      return { consume: true }
    }
  })
  tui.start()
  return done
}

function bar(value, total, width = 30) {
  const ratio = total ? Math.min(1, value / total) : 0
  const filled = Math.round(width * ratio)
  return `${c.green('█'.repeat(filled))}${c.dim('░'.repeat(width - filled))} ${Math.round(ratio * 100)}%`
}

export const PET_ASCII = {
  panda: [' .--. .--.', '(  o w o  )', ' /  >*<  \\'],
  cat: [' /\\_/\\', '( o.o )', ' > ^ <~'],
  dog: [' / \\__', '(    @\\___', ' /         O', '/   (_____/', '/_____/   U'],
  rabbit: [' (\\_/)', ' (o.o)', ' / > <\\'],
  fox: [' /\\   /\\', '(  o.o  )', ' /  ^  \\'],
  bear: [' .----.', '( o.o )', ' / >*< \\'],
  koala: [' .-"""-.', '(  o.o  )', ' /  U  \\'],
  tiger: [' /^=^\\', '( o.o )', ' / =^= \\'],
  lion: [' {^~~~^}', '( o.o )', ' /  v  \\'],
  frog: [' @..@', '( o.o )', '/ >*< \\'],
  penguin: [' _~_', '(o.o)', ' / V \\'],
  owl: [' ,_,', '(O.O)', ' /)_(\\'],
  duck: ['   __', ' >(o )__', '  (___/'],
  chick: [' ,~.', '(o.o)', ' / v \\'],
  hamster: ['(.___.)', '( o.o )', ' / >o< \\'],
  mouse: [' ()_()', ' (o.o)', ' / > <\\'],
  unicorn: ['   /^', ' / o.o \\', '(   ^   )'],
  dragon: [' /\\^/\\', '( o.o )', ' /  v  \\'],
  robot: ['.-----.', '|[o.o]|', '|__^__|'],
  alien: [' .---.', '/ o.o \\', '( > < )'],
  octopus: [' .---.', '( o.o )', ' /|/ \\|\\'],
  whale: ['    __', ' __/o \\___', '/_________/'],
  bee: [' \\   /', '--(o.o)--', ' /_=_\\'],
  butterfly: ['.==. .==.', ' \\ o.o /', '  \\ | /'],
  seedling: [' \\|/', '  |', ' _|_'],
}

export function normalizeAsciiArt(lines) {
  const rightTrimmed = lines.map((line) => line.trimEnd())
  const indents = rightTrimmed.filter((line) => line.trim()).map((line) => line.match(/^ */)?.[0].length || 0)
  const commonIndent = indents.length ? Math.min(...indents) : 0
  return rightTrimmed.map((line) => line.slice(commonIndent))
}

export function animateSpeciesArt(petId, lines, frame, activity = 'idle', level = 3) {
  if (frame % 2 === 0 || level < 3) return lines
  if (petId === 'cat') return lines.map((line, index) => (index === lines.length - 1 ? line.replace(/\\$/, '~') : line))
  if (petId === 'dog') return lines.map((line) => line.replace(/O$/, 'o'))
  if (petId === 'frog') return lines.map((line, index) => (index === 0 ? line.replace('@..@', '@oo@') : line))
  if (petId === 'rabbit') return lines.map((line, index) => (index === 0 ? line.replace('(\\_/)', '(/_\\)') : line))
  if (petId === 'owl') return lines.map((line) => line.replace('(O.O)', '(o.O)'))
  if (petId === 'penguin') return lines.map((line) => line.replace('/ V \\', '\\ V /'))
  if (petId === 'duck') return lines.map((line) => line.replace('>(o )', '=(o )'))
  if (petId === 'chick') return lines.map((line) => line.replace(',~.', '.~,').replace('/ v \\', '\\ v /'))
  if (petId === 'bee') return lines.map((line) => line.replace('\\   /', '/   \\'))
  if (petId === 'butterfly') return lines.map((line) => line.replace('.==. .==.', '.--. .--.'))
  if (petId === 'robot') return lines.map((line) => line.replace('[o.o]', activity === 'celebrate' ? '[^.^]' : '[-.-]'))
  if (petId === 'seedling') return lines.map((line, index) => (index === 0 ? line.replace('\\|/', '/|\\') : line))
  if (petId === 'octopus') return lines.map((line) => line.replace('\\/|\\/', '/\\|/\\'))
  if (petId === 'whale') return lines.map((line, index) => (index === 0 ? line.replace('__', '~~') : line))
  return lines
}

export function applyPetExpression(petId, lines, expression) {
  if (!expression) return lines
  return lines.map((line) => {
    if (petId === 'panda') return line.replace('o w o', `${expression} w ${expression}`)
    if (petId === 'dog') return line.replace('@', expression)
    if (petId === 'duck') return line.replace('(o )', `(${expression} )`)
    if (petId === 'whale') return line.replace('/o ', `/${expression} `)
    return line.replace(/o\.o|O\.O/g, `${expression}.${expression}`)
  })
}

export function applyGrowthArt(lines, level = 1) {
  const stage = petGrowthStage(level).id
  const artWidth = Math.max(0, ...lines.map(visibleWidth))
  const centered = (line) => `${' '.repeat(Math.max(0, Math.floor((artWidth - visibleWidth(line)) / 2)))}${line}`
  if (stage === 'star') return [centered('* .*. *'), ...lines]
  if (stage === 'shining') return [centered('.  *  .'), ...lines]
  return lines
}

export function buddyView(pet, frame, message, language, width = 25, activity = 'idle', accessory = null, level = 1) {
  const state = {
    idle: language === 'en' ? 'ready' : '准备好了',
    calm: language === 'en' ? 'with you' : '陪着你',
    feed: language === 'en' ? 'snack time' : '吃点心',
    play: language === 'en' ? 'playing' : '玩耍中',
    cheer: language === 'en' ? 'cheering' : '为你加油',
    celebrate: language === 'en' ? 'great streak' : '连击庆祝',
    comfort: language === 'en' ? 'still here' : '依然陪着你',
    sleep: language === 'en' ? 'resting' : '休息一下',
  }[activity]
  const art = PET_ASCII[pet.id] || PET_ASCII.cat
  const prop =
    activity === 'feed'
      ? frame % 2
        ? '  [ snack ]'
        : ' [ snack ] '
      : activity === 'play'
      ? frame % 2
        ? ' o'
        : '   o'
      : activity === 'cheer' || activity === 'celebrate'
      ? frame % 2
        ? '  * *'
        : ' *  * '
      : activity === 'comfort'
      ? '  <3'
      : activity === 'sleep'
      ? frame % 2
        ? ' z Z'
        : '  z'
      : ''
  const dressed = applyGrowthArt(
    animateSpeciesArt(pet.id, normalizeAsciiArt(decoratePetArt(art, accessory?.id)), frame, activity, level),
    level,
  )
  const expression = activity === 'sleep' ? '-' : activity === 'cheer' || activity === 'celebrate' ? '^' : frame % 6 === 0 ? '-' : null
  const animated = applyPetExpression(pet.id, dressed, expression)
  const heading = pet.name
  const artWidth = Math.max(0, ...animated.map(visibleWidth))
  const canvasWidth = Math.max(artWidth, visibleWidth(heading))
  const blockPadding = ' '.repeat(Math.floor((canvasWidth - artWidth) / 2))
  const centeredArt = animated.map((line) => `${blockPadding}${line}`)
  const centeredProp = prop ? `${' '.repeat(Math.floor((canvasWidth - visibleWidth(prop.trim())) / 2))}${prop.trim()}` : ''
  const speech = truncateToWidth(`“${message || state}”`, width)
  return [
    c.bold(c.cyan(heading)),
    ...centeredArt.map((line) => c.purple(line)),
    ...(centeredProp ? [c.yellow(centeredProp)] : []),
    c.dim(speech),
  ]
}

class CompanionPanel {
  focused = false
  constructor(config, profile, requestRender) {
    this.config = config
    this.profile = profile
    this.requestRender = requestRender
    this.frame = 0
    this.activity = 'idle'
    this.message = buddyMessages(config.language).start
    this.resume()
  }
  resume() {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.frame += 1
      this.requestRender()
    }, 900)
    this.timer.unref?.()
  }
  pause() {
    clearInterval(this.timer)
    this.timer = null
  }
  react(activity, message) {
    this.activity = activity
    this.message = message
    clearTimeout(this.activityTimeout)
    this.activityTimeout = setTimeout(() => {
      this.activity = 'idle'
      this.message = buddyMessages(this.config.language).start
      this.requestRender()
    }, 2800)
    this.activityTimeout.unref?.()
    this.requestRender()
  }
  dispose() {
    this.pause()
    clearTimeout(this.activityTimeout)
  }
  invalidate() {}
  render(width) {
    const pet = currentPet(this.config)
    const panelWidth = Math.max(24, Math.min(31, width - 4))
    const accessory = PET_ACCESSORIES.find((item) => item.id === this.profile.equippedAccessory)
    return [
      '',
      ...buddyView(pet, this.frame, this.message, this.config.language, panelWidth, this.activity, accessory, this.profile.petLevel).map(
        (line) => `  ${line}`,
      ),
    ]
  }
}

function studyBox(lines, width = 43) {
  const inner = width - 2
  const fit = (text) => {
    const clipped = truncateToWidth(text, inner - 2)
    return ` ${clipped}${' '.repeat(Math.max(0, inner - 2 - visibleWidth(clipped)))} `
  }
  return [c.purple(`╭${'─'.repeat(inner)}╮`), ...lines.map((line) => `│${fit(line)}│`), c.purple(`╰${'─'.repeat(inner)}╯`)]
}

function placeRight(leftLines, rightLines, width, rowOffset = 3) {
  const gap = 3
  const rightWidth = Math.max(...rightLines.map(visibleWidth))
  const start = width - rightWidth - 2
  if (start < 42) return [...leftLines, '', ...rightLines.map((line) => `  ${line}`)]
  const result = [...leftLines]
  while (result.length < rightLines.length + rowOffset) result.push('')
  rightLines.forEach((right, index) => {
    const row = index + rowOffset
    const left = result[row] || ''
    const padding = Math.max(gap, start - visibleWidth(left))
    result[row] = `${left}${' '.repeat(padding)}${right}`
  })
  return result
}

class Practice {
  focused = false
  constructor({ words, config, profile, dictionary, onExit, onComplete, requestCommand, requestRender, dailyReward }) {
    Object.assign(this, { words, config, profile, dictionary, onExit, onComplete, requestCommand, requestRender })
    this.index = 0
    this.typed = ''
    this.correct = 0
    this.mistakes = 0
    this.keystrokes = 0
    this.hadError = false
    this.startedAt = Date.now()
    this.pet = currentPet(config)
    this.buddyCopy = buddyMessages(config.language)
    this.petFrame = 0
    this.petState = dailyReward?.awarded ? 'celebrate' : 'calm'
    this.petMessage = dailyReward?.message || this.buddyCopy.start
    this.petMessageUntil = Date.now() + (dailyReward?.awarded ? 3200 : 2400)
    this.petStateUntil = this.petMessageUntil
    this.lastInputAt = Date.now()
    this.resume()
    void this.say()
  }
  pause() {
    if (this.animation) {
      clearInterval(this.animation)
      this.animation = null
    }
  }
  resume() {
    if (this.animation) return
    this.animation = setInterval(() => {
      this.petFrame += 1
      if (Date.now() > this.petStateUntil && this.petState !== 'sleep') this.petState = 'calm'
      if (Date.now() - this.lastInputAt > 9000 && this.petState === 'calm') {
        this.petState = 'sleep'
        this.petMessage = this.config.language === 'zh-CN' ? '我在等你，慢慢来。' : 'I’m still here. Take your time.'
      }
      this.requestRender()
    }, 650)
    this.animation.unref?.()
    this.requestRender()
  }
  dispose() {
    this.pause()
  }
  invalidate() {}
  get word() {
    return this.words[this.index]
  }
  async say() {
    if (this.word) await speak(this.word.name, this.config, { accent: this.config.accent })
  }
  setPetState(state, message, duration = 1600) {
    this.petState = state
    this.petMessage = message
    this.petMessageUntil = Date.now() + duration
    this.petStateUntil = this.petMessageUntil
  }
  clue(target) {
    const mode = this.config.practiceMode || 'learn'
    if (mode === 'learn') return target
    if (mode === 'hideAll') return target.replace(/[A-Za-z]/g, '_')
    if (mode === 'hideVowel') return target.replace(/[aeiou]/gi, '_')
    if (mode === 'hideConsonant') return target.replace(/[b-df-hj-np-tv-z]/gi, '_')
    return [...target].map((letter, i) => (/[A-Za-z]/.test(letter) && i % 2 === 0 ? '_' : letter)).join('')
  }
  render(width) {
    const entry = this.word
    if (!entry) return ['']
    const target = entry.name
    const mode = this.config.practiceMode || 'learn'
    const preview = answerPreview(target, this.typed, mode)
    const shown = [...target]
      .map((letter, i) => {
        if (i >= this.typed.length) return c.dim(preview[i])
        return this.typed[i]?.toLowerCase() === letter.toLowerCase() ? c.green(letter) : c.red(letter)
      })
      .join('')
    const phone = this.config.accent === 'uk' ? entry.ukphone : entry.usphone
    const tips =
      this.config.language === 'en'
        ? ['Ctrl+J replay audio', '→ skip word  ·  Esc back', '/ pause and open commands']
        : ['Ctrl+J 重新发音', '→ 跳过当前词  ·  Esc 返回', '/ 暂停并打开命令']
    const tip = this.index % 4 === 3 ? '' : tips[this.index % tips.length]
    const petMessage = Date.now() < this.petMessageUntil ? this.petMessage : ''
    const study = studyBox([
      c.dim((entry.trans || []).join('；')),
      phone ? c.cyan(`/ ${phone} /`) : '',
      '',
      c.bold(this.clue(target)),
      '',
      `${shown}${c.yellow('▌')}`,
    ])
    const content = [
      '',
      `  ${c.bold(c.purple('PanwithU'))}  ${c.dim(`${this.dictionary.name} / Unit ${this.config.chapter + 1}`)}  ${c.dim(
        `${this.index + 1}/${this.words.length}`,
      )}`,
      `  ${bar(this.index, this.words.length, 24)}`,
      ...study.map((line) => `  ${line}`),
      '',
      tip ? `  ${c.dim(tip)}` : '',
    ]
    const accessory = PET_ACCESSORIES.find((item) => item.id === this.profile.equippedAccessory)
    const buddy = buddyView(this.pet, this.petFrame, petMessage, this.config.language, 25, this.petState, accessory, this.profile.petLevel)
    return placeRight(content, buddy, width)
  }
  finishWord(isCorrect) {
    playFeedbackSound(isCorrect)
    updateWordMemory(this.profile, this.word.name, isCorrect)
    if (isCorrect) {
      this.correct += 1
      this.profile.streak += 1
      this.profile.stars += 2
      this.profile.bond += 2
      this.profile.mood = Math.min(100, this.profile.mood + 1)
      if (this.profile.streak % 3 === 0) {
        this.setPetState('celebrate', this.buddyCopy.streak[this.profile.streak % this.buddyCopy.streak.length], 1800)
      } else if (this.index % 3 === 0) {
        this.setPetState('cheer', this.buddyCopy.correct, 1200)
      }
    } else {
      this.mistakes += 1
      this.profile.streak = 0
      this.setPetState('comfort', this.buddyCopy.wrong, 1600)
    }
    this.index += 1
    this.typed = ''
    this.hadError = false
    if (this.index >= this.words.length) {
      this.profile.learned += this.words.length
      this.profile.correct += this.correct
      this.profile.wrong += this.words.length - this.correct
      this.profile.petLevel = Math.floor(this.profile.bond / 50) + 1
      this.profile.sessions.push({
        at: new Date().toISOString(),
        count: this.words.length,
        correct: this.correct,
        dictionary: this.dictionary.id,
        chapter: this.config.chapter,
      })
      this.profile.sessions = this.profile.sessions.slice(-100)
      const minutes = Math.max((Date.now() - this.startedAt) / 60000, 1 / 60)
      this.dispose()
      this.onComplete({ correct: this.correct, count: this.words.length, wpm: Math.round(this.keystrokes / 5 / minutes) })
    } else {
      void this.say()
      this.requestRender()
    }
  }
  handleInput(data) {
    if (matchesKey(data, 'escape')) {
      this.dispose()
      return this.onExit()
    }
    if (matchesKey(data, 'ctrl+j')) return void this.say()
    if (matchesKey(data, 'right')) return this.finishWord(false)
    if (matchesKey(data, 'backspace')) {
      this.typed = this.typed.slice(0, -1)
      return this.requestRender()
    }
    // pi-tui's decoder only covers enhanced keyboard protocols. Most terminals
    // still send ordinary printable characters as a one-byte legacy sequence.
    const printable = printableKey(data)
    if (printable === '/' && !this.typed) {
      return this.requestCommand()
    }
    if (!printable || printable.length !== 1 || this.typed.length >= this.word.name.length) return
    this.lastInputAt = Date.now()
    if (this.petState === 'sleep')
      this.setPetState('cheer', this.config.language === 'zh-CN' ? '回来啦，我们继续。' : 'You’re back. Let’s go!', 1200)
    playKeySound()
    const expected = this.word.name[this.typed.length]
    this.keystrokes += 1
    if (printable.toLowerCase() !== expected.toLowerCase()) this.hadError = true
    this.typed += printable
    if (this.typed.length === this.word.name.length)
      this.finishWord(!this.hadError && this.typed.toLowerCase() === this.word.name.toLowerCase())
    else this.requestRender()
  }
}

export async function runTui(config, profile, persist) {
  const tx = (zh, en) => (config.language === 'en' ? en : zh)
  const modes = () => modeCopy[config.language === 'en' ? 'en' : 'zh-CN']
  config.colorTheme = setColorTheme(config.colorTheme || 'violet')
  const catalog = await loadDictionaryCatalog()
  const terminal = new ProcessTerminal()
  const tui = new TuiAltScreen(terminal, true)
  let resolveDone
  const done = new Promise((resolve) => {
    resolveDone = resolve
  })
  const root = new Container()
  tui.addChild(root)
  const companion = new CompanionPanel(config, profile, () => tui.requestRender())
  let activePractice = null
  let pausedPractice = null
  let dictionary = catalog.find((item) => item.id === config.dictionaryId) || catalog[0]
  config.dictionaryId = dictionary.id
  config.chapter = Math.max(0, Math.min(Number(config.chapter) || 0, dictionary.chapters - 1))
  config.practiceMode ||= 'learn'

  const editor = new Editor(tui, editorTheme, { autocompleteMaxVisible: 9 })
  const commands = [
    ['help', '显示所有命令', 'Show all commands'],
    ['quit', '退出 PanwithU', 'Quit PanwithU'],
    ['home', '返回主页', 'Return home'],
    ['learn', '开始当前单元', 'Start the current unit'],
    ['dict', '选择或搜索题库', 'Choose or search dictionaries'],
    ['chapter', '选择单元', 'Choose a unit'],
    ['mode', '选择学习/默写模式', 'Choose learning or dictation'],
    ['progress', '查看学习进度', 'View learning progress'],
    ['coach', '获取伙伴学习建议', 'Get buddy learning advice'],
    ['pet', '宠物中心', 'Pet center'],
    ['config', '修改本地设置', 'Change local settings'],
    ['invite', '添加或修改邀请码', 'Add or change invitation code'],
    ['language', '切换系统语言', 'Change system language'],
    ['color', '切换主题颜色', 'Change color theme'],
  ].map(([name, zh, en]) => ({ name, zh, en, description: config.language === 'en' ? en : zh }))
  const localizeCommands = () => commands.forEach((command) => (command.description = config.language === 'en' ? command.en : command.zh))
  commands.find((item) => item.name === 'dict').getArgumentCompletions = async (prefix) =>
    catalog
      .filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(prefix.toLowerCase()))
      .slice(0, 30)
      .map((item) => ({ value: item.id, label: item.name, description: item.description }))
  // Command-only completion avoids invoking filesystem completion when `/` is
  // pressed, making the palette instant even in a large repository.
  editor.setAutocompleteProvider({
    triggerCharacters: ['/'],
    async getSuggestions(lines, cursorLine, cursorCol) {
      const input = lines[cursorLine].slice(0, cursorCol)
      if (!input.startsWith('/')) return null
      const petMatch = input.match(/^\/pet\s+(.*)$/)
      if (petMatch) {
        const query = petMatch[1].toLowerCase()
        const actions = [
          ['status', tx('查看宠物状态', 'View pet status')],
          ['change', tx('更换伙伴', 'Change companion')],
          ['rename', tx('重新取名', 'Rename')],
          ['feed', tx('喂食', 'Feed')],
          ['play', tx('玩耍', 'Play')],
          ['wardrobe', tx('小衣柜', 'Wardrobe')],
        ]
        return {
          items: actions
            .filter(([name]) => name.startsWith(query))
            .map(([name, description]) => ({ value: `/pet ${name}`, label: name, description })),
          prefix: input,
        }
      }
      const dictMatch = input.match(/^\/dict\s+(.*)$/)
      if (dictMatch) {
        const query = dictMatch[1].toLowerCase()
        const items = catalog
          .filter((item) => `${item.name} ${item.description} ${item.id}`.toLowerCase().includes(query))
          .slice(0, 30)
          .map((item) => ({ value: `/dict ${item.id}`, label: item.name, description: item.description }))
        return { items, prefix: input }
      }
      if (/\s/.test(input)) return null
      const query = input.slice(1).toLowerCase()
      return {
        items: commands
          .filter((item) => item.name.startsWith(query))
          .map((item) => ({ value: `/${item.name}`, label: `/${item.name}`, description: item.description })),
        prefix: input,
      }
    },
    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      const line = lines[cursorLine]
      const start = cursorCol - prefix.length
      const next = [...lines]
      next[cursorLine] = `${line.slice(0, start)}${item.value}${line.slice(cursorCol)}`
      return { lines: next, cursorLine, cursorCol: start + item.value.length }
    },
  })

  const mount = (title, body, focus = body) => {
    companion.resume()
    root.clear()
    root.addChild(new Text(`\n  ${c.bold(c.purple('PanwithU'))}`))
    root.addChild(new Frame(title, body))
    root.addChild(companion)
    root.addChild(new Text(c.dim('  /    ↑↓    ↵    esc')))
    editor.setText('')
    tui.setFocus(focus)
    tui.requestRender(true)
  }
  const mountEditor = (title, input) => {
    companion.resume()
    root.clear()
    root.addChild(new Text(`\n  ${c.bold(c.purple('PanwithU'))}`))
    root.addChild(new Frame(title, input))
    root.addChild(companion)
    root.addChild(new Text(c.dim('  ↵ confirm    esc back')))
    tui.setFocus(input)
    tui.requestRender(true)
  }
  const menu = (title, items, onSelect, cancel = home) => {
    const list = new SelectList(items, 12, selectTheme)
    list.onSelect = onSelect
    list.onCancel = cancel
    mount(title, list, list)
  }
  const mountPractice = (practice) => {
    companion.pause()
    root.clear()
    root.addChild(practice)
    tui.setFocus(practice)
    tui.requestRender(true)
  }
  const save = async () => {
    await persist.saveConfig(config)
    await persist.saveProfile({ ...profile, lastSeenAt: new Date().toISOString() })
  }
  const quit = async () => {
    activePractice?.dispose()
    activePractice = null
    companion.dispose()
    await save()
    tui.stop()
    resolveDone()
  }
  const chooseMode = () =>
    menu(
      tx('选择练习模式', 'Choose practice mode'),
      Object.entries(modes()).map(([value, [, label]]) => ({ value, label })),
      async ({ value }) => {
        config.practiceMode = value
        await save()
        home()
      },
    )
  const chooseChapter = () =>
    menu(
      `${dictionary.name} · ${tx('选择单元', 'Choose a unit')}`,
      Array.from({ length: dictionary.chapters }, (_, i) => ({
        value: String(i),
        label: `Unit ${i + 1}`,
        description: `${tx('单词', 'Words')} ${i * 20 + 1}–${Math.min(dictionary.length, (i + 1) * 20)}`,
      })),
      async ({ value }) => {
        config.chapter = Number(value)
        await save()
        home()
      },
    )
  const chooseDictionary = () => {
    const categories = [...new Set(catalog.map((item) => item.category))]
    menu(
      tx('选择题库分类', 'Choose a dictionary category'),
      categories.map((value) => ({
        value,
        label: value,
        description: `${catalog.filter((item) => item.category === value).length} ${tx('个题库', 'dictionaries')}`,
      })),
      ({ value }) => {
        const list = catalog.filter((item) => item.category === value)
        menu(
          `${value} · ${tx('选择题库', 'Choose a dictionary')}`,
          list.map((item) => ({
            value: item.id,
            label: item.name,
            description: `${item.length} ${tx('词', 'words')} · ${item.chapters} ${tx('单元', 'units')}`,
          })),
          async ({ value: id }) => {
            dictionary = catalog.find((item) => item.id === id)
            config.dictionaryId = id
            config.chapter = 0
            await save()
            home()
          },
          chooseDictionary,
        )
      },
    )
  }
  const showMessage = (title, message, onBack) => {
    const back = new SelectList([{ value: 'back', label: tx('返回', 'Back') }], 1, selectTheme)
    back.onSelect = onBack
    back.onCancel = onBack
    companion.resume()
    root.clear()
    root.addChild(new Text(`\n  ${c.bold(c.purple('PanwithU'))}`))
    root.addChild(new Frame(title, new Text(message, 1, 1)))
    root.addChild(back)
    root.addChild(companion)
    tui.setFocus(back)
    tui.requestRender(true)
  }
  const coach = async () => {
    const title = tx('伙伴学习建议', 'Buddy learning advice')
    if (!config.invitationCode) {
      showMessage(
        title,
        tx(
          '还没有邀请码。使用 /invite 添加后，我就能根据你的学习记录给出建议。',
          'No invitation code yet. Add one with /invite and I can use your learning history to help.',
        ),
        progress,
      )
      return
    }
    showMessage(title, tx('正在读你的学习记录…', 'Reading your learning history…'), progress)
    try {
      const { askCoach } = await import('./ai.mjs')
      const advice = await askCoach(
        config,
        profile,
        'Give one concrete observation about my vocabulary learning and a three-step plan for my next session.',
      )
      showMessage(
        title,
        advice || tx('再完成一次练习，我就能给出更准确的建议。', 'Complete another session and I can give better advice.'),
        progress,
      )
    } catch {
      showMessage(
        title,
        tx('暂时无法连接学习助手，请稍后再试。', 'The learning assistant is unavailable right now. Please try again later.'),
        progress,
      )
    }
  }
  const progress = () => {
    const total = profile.correct + profile.wrong
    const accuracy = total ? Math.round((profile.correct / total) * 100) : 0
    const words = Object.values(profile.words || {})
    const mastered = words.filter((word) => Number(word.intervalDays || 0) >= 7).length
    const weekAgo = Date.now() - 7 * 86_400_000
    const recent = profile.sessions.filter((session) => new Date(session.at).getTime() >= weekAgo)
    const weeklyWords = recent.reduce((sum, session) => sum + Number(session.count || 0), 0)
    const due = dueWordCount(profile)
    menu(
      tx('学习进度', 'Learning progress'),
      [
        {
          value: 'overview',
          label: tx('学习总览', 'Overview'),
          description: tx(
            `累计练习 ${profile.learned} 词 · 接触 ${words.length} 词`,
            `${profile.learned} attempts · ${words.length} words seen`,
          ),
        },
        { value: 'accuracy', label: tx('正确率', 'Accuracy'), description: `${bar(accuracy, 100, 16)} · ${profile.correct}/${total}` },
        {
          value: 'memory',
          label: tx('记忆状态', 'Memory'),
          description: tx(`稳定记忆 ${mastered} 词 · 待复习 ${due} 词`, `${mastered} stable · ${due} due for review`),
        },
        {
          value: 'week',
          label: tx('最近 7 天', 'Last 7 days'),
          description: tx(`${recent.length} 次练习 · ${weeklyWords} 词`, `${recent.length} sessions · ${weeklyWords} words`),
        },
        {
          value: 'companion',
          label: tx('伙伴成长', 'Buddy growth'),
          description: `Lv.${profile.petLevel} · ${tx('羁绊', 'bond')} ${profile.bond} · ${tx('同行', 'together')} ${
            profile.companionDays || 0
          } ${tx('天', 'days')}`,
        },
        {
          value: 'coach',
          label: tx('获取伙伴学习建议', 'Get buddy learning advice'),
          description: config.invitationCode
            ? tx('根据你的记录生成个性化建议', 'Personalized from your learning history')
            : tx('需要先添加邀请码', 'Invitation code required'),
        },
        { value: 'home', label: tx('返回主页', 'Back home') },
      ],
      ({ value }) => (value === 'coach' ? coach() : value === 'home' ? home() : progress()),
    )
  }
  const renamePet = () => {
    const pet = currentPet(config)
    const input = new Input()
    input.setValue(pet.name)
    root.clear()
    root.addChild(new Text(`\n${c.bold(c.purple('  PanwithU'))}\n${c.cyan(`  ${tx('给宠物重新取名', 'Rename your pet')}`)}\n`))
    root.addChild(
      new Text(
        c.dim(
          tx(
            `  类型：${pet.type} · 当前名字：${pet.name}\n  输入新名字（1–20 个字符），按 Enter 保存。\n`,
            `  Type: ${pet.type} · Current name: ${pet.name}\n  Enter a new name (1–20 characters), then press Enter.\n`,
          ),
        ),
      ),
    )
    root.addChild(input)
    input.onSubmit = async (value) => {
      const name = value.trim()
      if (!name || [...name].length > 20) {
        tui.flash(tx('名字需要包含 1–20 个字符', 'The name must contain 1–20 characters'))
        return
      }
      config.petName = name
      await save()
      tui.flash(tx(`${name} 记住自己的新名字啦`, `${name} remembers the new name`))
      petPage()
    }
    input.onEscape = petPage
    tui.setFocus(input)
    tui.requestRender(true)
  }
  const petPage = () => {
    const pet = currentPet(config)
    const growth = petGrowthStage(profile.petLevel, config.language)
    menu(
      `${pet.name} · ${pet.type} · Lv.${profile.petLevel} · ${growth.name}`,
      [
        {
          value: 'status',
          label: tx('查看状态', 'View status'),
          description: tx(
            `${pet.type} · ${pet.personality} · 羁绊 ${profile.bond}${growth.nextLevel ? ` · 下阶段 Lv.${growth.nextLevel}` : ''}`,
            `${pet.type} · ${pet.personality} · bond ${profile.bond}${growth.nextLevel ? ` · next Lv.${growth.nextLevel}` : ''}`,
          ),
        },
        {
          value: 'change',
          label: tx('更换伙伴', 'Change companion'),
          description: tx('从 25 种伙伴中选择', 'Choose from 25 companions'),
        },
        { value: 'rename', label: tx('重新取名', 'Rename'), description: tx(`当前名字：${pet.name}`, `Current name: ${pet.name}`) },
        {
          value: 'feed',
          label: tx('喂食', 'Feed'),
          description: tx(`消耗 5 星星 · 当前 ${profile.stars}`, `Costs 5 stars · ${profile.stars} available`),
        },
        {
          value: 'play',
          label: tx('玩耍', 'Play'),
          description: tx(`消耗精力 · 羁绊 ${profile.bond}`, `Uses energy · bond ${profile.bond}`),
        },
        {
          value: 'wardrobe',
          label: tx('小衣柜', 'Wardrobe'),
          description: profile.equippedAccessory
            ? tx('已装备一件小配饰', 'An accessory is equipped')
            : tx('用星星解锁配饰', 'Unlock accessories with stars'),
        },
        { value: 'home', label: tx('返回主页', 'Back home') },
      ],
      async ({ value }) => {
        if (value === 'change') return changeCompanionPage()
        if (value === 'rename') return renamePet()
        if (value === 'feed') companion.react('feed', feed(config, profile, config.language))
        if (value === 'play') companion.react('play', play(config, profile, config.language))
        if (value === 'wardrobe') return wardrobe()
        if (value === 'status')
          tui.flash(tx(`${pet.name} 是一只 ${pet.type}，性格 ${pet.personality}`, `${pet.name} is a ${pet.personality} ${pet.type}`))
        await save()
        value === 'home' ? home() : petPage()
      },
    )
  }
  const changeCompanionPage = () => {
    const activePet = currentPet(config)
    const items = PETS.map((pet) => ({
      value: pet.id,
      label: `${pet.name}${pet.id === activePet.id ? tx('（当前）', ' (current)') : ''}`,
      description: `${pet.id} · ${pet.personality}`,
    }))
    const list = new SelectList(items, 7, selectTheme)
    list.setSelectedIndex(
      Math.max(
        0,
        PETS.findIndex((pet) => pet.id === activePet.id),
      ),
    )
    const preview = new Text('')
    const renderPreview = (petId) => {
      const pet = PETS.find((item) => item.id === petId) || PETS[0]
      const growth = petGrowthStage(profile.petLevel, config.language)
      const art = applyGrowthArt(
        animateSpeciesArt(pet.id, normalizeAsciiArt(PET_ASCII[pet.id] || PET_ASCII.cat), 1, 'idle', profile.petLevel),
        profile.petLevel,
      )
      preview.setText(
        `\n  ${c.bold(c.cyan(pet.name))}  ${c.dim(`${pet.id} / ${pet.personality} / Lv.${profile.petLevel} ${growth.name}`)}\n${art
          .map((line) => `  ${c.purple(line)}`)
          .join('\n')}\n\n  ${c.dim(tx('Enter 确认 · Esc 返回', 'Enter confirm · Esc back'))}`,
      )
      tui.requestRender(true)
    }
    const body = new Container()
    body.addChild(list)
    body.addChild(preview)
    list.onSelectionChange = ({ value }) => renderPreview(value)
    list.onCancel = petPage
    list.onSelect = async ({ value }) => {
      const pet = changeCompanion(config, value)
      companion.pet = pet
      companion.react('celebrate', tx(`${pet.name} 成为你的新伙伴啦`, `${pet.name} is your new companion`))
      await save()
      petPage()
    }
    companion.pause()
    root.clear()
    root.addChild(new Text(`\n  ${c.bold(c.purple('PanwithU'))}`))
    root.addChild(new Frame(tx('更换伙伴', 'Change companion'), body))
    tui.setFocus(list)
    renderPreview(activePet.id)
  }
  const wardrobe = () =>
    menu(
      tx('小衣柜', 'Wardrobe'),
      PET_ACCESSORIES.map((item) => {
        const owned = profile.petAccessories.includes(item.id)
        return {
          value: item.id,
          label: config.language === 'en' ? item.nameEn : item.name,
          description: owned
            ? profile.equippedAccessory === item.id
              ? tx('正在佩戴', 'Equipped')
              : tx('已拥有 · Enter 装备', 'Owned · Enter to equip')
            : tx(`${item.cost} 星星 · 解锁后立即试穿`, `${item.cost} stars · Unlock and equip`),
        }
      }).concat({ value: 'back', label: tx('返回宠物中心', 'Back to pet center') }),
      async ({ value }) => {
        if (value === 'back') return petPage()
        const result = buyAccessory(profile, value)
        if (!result.ok) {
          companion.react(
            'comfort',
            tx(
              `还差 ${result.accessory.cost - profile.stars} 星星，再练一会儿吧。`,
              `${result.accessory.cost - profile.stars} more stars. Let’s practice a little longer.`,
            ),
          )
        } else {
          const accessoryName = config.language === 'en' ? result.accessory.nameEn : result.accessory.name
          companion.react(
            'celebrate',
            result.equipped
              ? tx(`${accessoryName} 已装备。`, `${accessoryName} equipped.`)
              : tx(`解锁 ${accessoryName}！`, `${accessoryName} unlocked!`),
          )
          await save()
        }
        petPage()
      },
      petPage,
    )
  const resumePractice = () => {
    if (!pausedPractice) return home()
    activePractice = pausedPractice
    pausedPractice = null
    activePractice.resume()
    mountPractice(activePractice)
  }
  const leavePausedPractice = () => {
    pausedPractice?.dispose()
    pausedPractice = null
    activePractice = null
  }
  const openCommandPalette = (practice = null) => {
    if (practice) {
      pausedPractice = practice
      practice.pause()
    }
    const paletteCommands = practice ? [{ name: 'resume', description: tx('继续当前练习', 'Resume practice') }, ...commands] : commands
    const palette = new CommandPalette(
      paletteCommands,
      selectTheme,
      (raw) => {
        if (raw === '/resume' && pausedPractice) return resumePractice()
        leavePausedPractice()
        void execute(raw)
      },
      practice ? resumePractice : home,
      (raw) => {
        editor.setText(raw)
        mountEditor('command', editor)
      },
    )
    mount(tx('命令', 'Commands'), palette, palette)
  }
  const editInvitationCode = () => {
    const input = new SecretInput()
    root.clear()
    root.addChild(new Text(`\n${c.bold(c.purple('  PanwithU'))}\n${c.cyan(`  ${tx('修改邀请码', 'Change invitation code')}`)}\n`))
    root.addChild(
      new Text(
        config.invitationCode
          ? c.dim(
              tx(
                `  当前已配置：${config.invitationCode.slice(0, 3)}••••${config.invitationCode.slice(
                  -3,
                )}\n  输入新邀请码并按 Enter，直接按 Esc 返回。\n`,
                `  Configured: ${config.invitationCode.slice(0, 3)}••••${config.invitationCode.slice(
                  -3,
                )}\n  Enter a new code and press Enter, or Esc to go back.\n`,
              ),
            )
          : c.dim(
              tx(
                '  当前未配置。输入邀请码并按 Enter 保存，按 Esc 返回。\n',
                '  Not configured. Enter a code and press Enter, or Esc to go back.\n',
              ),
            ),
      ),
    )
    root.addChild(input)
    input.onSubmit = async (value) => {
      if (!value.trim()) {
        tui.flash(tx('邀请码未改变', 'Invitation code unchanged'))
        return settings()
      }
      config.invitationCode = value.trim()
      await save()
      tui.flash(tx('邀请码已保存到本机', 'Invitation code saved on this device'))
      settings()
    }
    input.onEscape = settings
    tui.setFocus(input)
    tui.requestRender(true)
  }
  const chooseLanguage = () =>
    menu(
      '选择系统语言 / Choose system language',
      [
        { value: 'zh-CN', label: '简体中文', description: config.language === 'zh-CN' ? '当前语言' : '' },
        { value: 'en', label: 'English', description: config.language === 'en' ? 'Current language' : '' },
      ],
      async ({ value }) => {
        config.language = value
        localizeCommands()
        await save()
        tui.flash(value === 'zh-CN' ? '系统语言已切换为简体中文' : 'System language changed to English')
        settings()
      },
      settings,
    )
  const chooseColor = () =>
    menu(
      tx('选择主题颜色', 'Choose color theme'),
      Object.entries(COLOR_THEMES).map(([value, theme]) => ({
        value,
        label: theme.name,
        description: `${theme.rainbow ? rainbowText('■■■■■■■') : `${ansi(theme.primary)('■■')} ${ansi(theme.accent)('■■')}`} ${
          value === config.colorTheme ? tx('当前主题', 'Current theme') : ''
        }`,
      })),
      async ({ value }) => {
        config.colorTheme = setColorTheme(value)
        await save()
        tui.flash(tx(`已切换为 ${COLOR_THEMES[value].name} 主题`, `Color theme changed to ${COLOR_THEMES[value].name}`))
        settings()
      },
      settings,
    )
  const settings = () =>
    menu(
      tx('本地设置', 'Local settings'),
      [
        {
          value: 'invite',
          label: tx('邀请码', 'Invitation code'),
          description: config.invitationCode ? tx('已配置', 'Configured') : tx('未配置', 'Not configured'),
        },
        { value: 'language', label: tx('系统语言', 'System language'), description: config.language === 'en' ? 'English' : '简体中文' },
        {
          value: 'accent',
          label: tx('英语发音', 'English pronunciation'),
          description: config.accent === 'uk' ? tx('英音', 'British') : tx('美音', 'American'),
        },
        {
          value: 'color',
          label: tx('主题颜色', 'Color theme'),
          description: COLOR_THEMES[config.colorTheme].name,
        },
        {
          value: 'clear',
          label: tx('清除邀请码', 'Clear invitation code'),
          description: tx('关闭智能学习建议与大模型语音兜底', 'Disable smart advice and generated speech fallback'),
        },
        { value: 'home', label: tx('返回主页', 'Back home') },
      ],
      async ({ value }) => {
        if (value === 'invite') return editInvitationCode()
        if (value === 'language') return chooseLanguage()
        if (value === 'color') return chooseColor()
        if (value === 'accent') {
          config.accent = config.accent === 'uk' ? 'us' : 'uk'
          await save()
          tui.flash(
            tx(
              `已切换为${config.accent === 'uk' ? '英音' : '美音'}`,
              `Changed to ${config.accent === 'uk' ? 'British' : 'American'} pronunciation`,
            ),
          )
          return settings()
        }
        if (value === 'clear') {
          config.invitationCode = ''
          await save()
          tui.flash(tx('邀请码已清除', 'Invitation code cleared'))
          return settings()
        }
        home()
      },
    )
  const start = async () => {
    activePractice?.dispose()
    const words = await loadChapter(dictionary, config.chapter)
    const dailyReward = claimDailyCompanion(profile, config.language)
    const practice = new Practice({
      words,
      config,
      profile,
      dictionary,
      onExit: home,
      requestCommand: () => openCommandPalette(practice),
      requestRender: () => tui.requestRender(),
      dailyReward,
      onComplete: async (result) => {
        activePractice = null
        const shouldAutoCoach = Boolean(
          config.invitationCode && profile.lastCompanionDay && profile.lastAiCoachDay !== profile.lastCompanionDay,
        )
        if (shouldAutoCoach) profile.lastAiCoachDay = profile.lastCompanionDay
        await save()
        companion.react(
          'celebrate',
          config.language === 'zh-CN' ? `我们完成了这一单元！羁绊 ${profile.bond}。` : `We finished this unit! Bond ${profile.bond}.`,
        )
        menu(
          tx('练习完成 ✦', 'Practice complete ✦'),
          [
            {
              value: 'again',
              label: tx('再练一次', 'Practice again'),
              description: `${result.correct}/${result.count} ${tx('正确', 'correct')} · ${Math.round(
                (result.correct / result.count) * 100,
              )}% · ${result.wpm} WPM · +${result.correct * 2} ${tx('星星', 'stars')}`,
            },
            { value: 'next', label: tx('下一个单元', 'Next unit') },
            { value: 'home', label: tx('返回主页', 'Back home') },
          ],
          ({ value }) => {
            if (value === 'next') config.chapter = Math.min(dictionary.chapters - 1, config.chapter + 1)
            value === 'home' ? home() : start()
          },
        )
        if (shouldAutoCoach) {
          void import('./ai.mjs')
            .then(({ askCoach }) => askCoach(config, profile, 'Give one warm, specific post-session observation in no more than 20 words.'))
            .then((message) => {
              if (message) companion.react('cheer', message)
            })
            .catch(() => {})
        }
      },
    })
    activePractice = practice
    mountPractice(practice)
  }
  function home() {
    menu(
      tx('今天想练什么？', 'What would you like to practice?'),
      [
        {
          value: 'start',
          label: tx('开始练习', 'Start practice'),
          description: `${dictionary.name} · Unit ${config.chapter + 1} · ${modes()[config.practiceMode][0]}`,
        },
        { value: 'dict', label: tx('选择题库', 'Choose dictionary'), description: dictionary.name },
        { value: 'chapter', label: tx('选择单元', 'Choose unit'), description: `Unit ${config.chapter + 1}/${dictionary.chapters}` },
        { value: 'mode', label: tx('练习模式', 'Practice mode'), description: modes()[config.practiceMode][0] },
        { value: 'progress', label: tx('学习进度', 'Learning progress') },
        {
          value: 'pet',
          label: tx('我的宠物', 'My pet'),
          description: `${currentPet(config).name} · Lv.${profile.petLevel} · ${profile.stars} ${tx('星', 'stars')}`,
        },
        {
          value: 'config',
          label: tx('本地设置', 'Local settings'),
          description: config.invitationCode
            ? tx('邀请码已配置', 'Invitation code configured')
            : tx('邀请码未配置', 'Invitation code not configured'),
        },
        { value: 'quit', label: tx('退出', 'Quit') },
      ],
      ({ value }) =>
        ((
          { start, dict: chooseDictionary, chapter: chooseChapter, mode: chooseMode, progress, pet: petPage, config: settings, quit }[
            value
          ] || home
        )()),
    )
  }
  const showHelp = () =>
    menu(
      tx('斜杠命令', 'Slash commands'),
      commands.map((item) => ({ value: item.name, label: `/${item.name}`, description: item.description })),
      ({ value }) => execute(`/${value}`),
    )
  const execute = async (raw) => {
    const [name, ...parts] = raw.trim().replace(/^\//, '').split(/\s+/)
    if (name === 'quit') return quit()
    if (name === 'help') return showHelp()
    if (name === 'home') return home()
    if (name === 'learn') return start()
    if (name === 'dict') {
      const found = catalog.find((item) => item.id === parts[0])
      if (found) {
        dictionary = found
        config.dictionaryId = found.id
        config.chapter = 0
        await save()
        return home()
      }
      return chooseDictionary()
    }
    if (name === 'chapter') return chooseChapter()
    if (name === 'mode') return chooseMode()
    if (name === 'progress') return progress()
    if (name === 'coach') return coach()
    if (name === 'pet') {
      if (parts[0] === 'change') return changeCompanionPage()
      if (parts[0] === 'rename') return renamePet()
      if (parts[0] === 'wardrobe') return wardrobe()
      if (parts[0] === 'feed') {
        companion.react('feed', feed(config, profile, config.language))
        await save()
        return petPage()
      }
      if (parts[0] === 'play') {
        companion.react('play', play(config, profile, config.language))
        await save()
        return petPage()
      }
      if (parts[0] === 'status') {
        const pet = currentPet(config)
        tui.flash(`${pet.name} · ${pet.type} · ${pet.personality} · Lv.${profile.petLevel}`)
      }
      return petPage()
    }
    if (name === 'config') return settings()
    if (name === 'invite' || name === 'apikey') return editInvitationCode()
    if (name === 'language') return chooseLanguage()
    if (name === 'color') return chooseColor()
    tui.flash(tx('未知命令，输入 /help 查看帮助', 'Unknown command. Use /help to see available commands.'))
    home()
  }
  editor.onSubmit = (text) => {
    editor.addToHistory(text)
    if (text.trim() === '/resume' && pausedPractice) return resumePractice()
    leavePausedPractice()
    void execute(text)
  }
  tui.addInputListener((data) => {
    if (matchesKey(data, 'ctrl+c')) {
      void quit()
      return { consume: true }
    }
    if (matchesKey(data, 'escape') && pausedPractice && editor.focused) {
      resumePractice()
      return { consume: true }
    }
    if (matchesKey(data, '/') && tui.children.length && !editor.focused) {
      openCommandPalette()
      return { consume: true }
    }
  })
  home()
  tui.start()
  await done
}
