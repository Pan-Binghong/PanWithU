import { APP_NAME, PETS, VERSION } from './constants.mjs'
import { learn } from './learning.mjs'
import { animatePet, currentPet, feed, play, showPet } from './pet.mjs'
import { installReminder, notify, parseReminderHour, reminderStatus, removeReminder } from './reminder.mjs'
import { loadConfig, loadProfile, saveConfig, saveProfile } from './storage.mjs'
import { activeTodos, addTodo, completeTodo, dueWordCount, syncLearningTodo } from './todo.mjs'
import { choose, clear, colors, createPrompt, logo, paint } from './ui.mjs'
import { readFileSync } from 'node:fs'
import { stdin } from 'node:process'

const copy = {
  'zh-CN': {
    language: '选择系统语言 / Choose system language',
    accent: '选择英语发音',
    code: '输入邀请码（可留空）: ',
    pet: '选择陪伴你的宠物',
    welcome: '欢迎来到 PanwithU。我们一起开始吧。',
  },
  en: {
    language: 'Choose system language / 选择系统语言',
    accent: 'Choose English pronunciation',
    code: 'Invitation code (optional): ',
    pet: 'Choose your companion',
    welcome: 'Welcome to PanwithU. Let’s begin together.',
  },
}

async function setup() {
  clear()
  console.log(logo())
  if (!stdin.isTTY) {
    const answers = readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean)
    const language = answers[0] === '2' ? 'en' : 'zh-CN'
    const accent = answers[1] === '2' ? 'uk' : 'us'
    const selectedPet = PETS[Math.max(0, Math.min(Number(answers[2] || 1) - 1, PETS.length - 1))]
    const config = {
      language,
      invitationCode: '',
      pet: selectedPet.id,
      petName: selectedPet.name,
      accent,
      colorTheme: 'violet',
      reminders: true,
      createdAt: new Date().toISOString(),
    }
    await saveConfig(config)
    console.log(`${copy[language].welcome}\n`)
    return config
  }
  const { runTuiSetup } = await import('./tui.mjs')
  const config = await runTuiSetup()
  if (!config) process.exitCode = 130
  if (!config) return null
  await saveConfig(config)
  console.log(`\n${copy[config.language].welcome}\n`)
  return config
}

function help() {
  console.log(
    `${APP_NAME} ${VERSION}\n\nUsage: PWU [command]\n       PWU                 Open the interactive terminal UI\n\nCommands:\n  learn [count]   Practice English words\n  pet             Visit your companion\n  feed            Feed your companion (5 stars)\n  play            Play together\n  todo            Show the learning plan\n  reminder        Manage the daily system reminder\n  summary         Get a personal learning summary\n  status          Show learning progress\n  config          Run first-time setup again\n  pan             Discover a small secret\n  help, --help    Show this help\n\nInteractive commands:\n  /help  /quit  /home  /learn  /dict  /chapter  /mode\n  /progress  /coach  /pet  /config  /invite  /language  /color\n\nPet subcommands:\n  /pet status  /pet change  /pet rename  /pet feed  /pet play  /pet wardrobe\n`,
  )
}

async function status(config, profile) {
  const pet = currentPet(config)
  const total = profile.correct + profile.wrong
  const unique = Object.keys(profile.words || {}).length
  const due = dueWordCount(profile)
  if (config.language === 'zh-CN')
    console.log(
      `\n${pet.name} · Lv.${profile.petLevel}\n练习次数：${profile.learned}\n接触单词：${unique}\n待复习：${due}\n正确率：${
        total ? Math.round((profile.correct / total) * 100) : 0
      }%\n星星：${profile.stars} ⭐\n羁绊：${profile.bond} ♡\n`,
    )
  else
    console.log(
      `\n${pet.name} · Lv.${profile.petLevel}\nAttempts: ${profile.learned}\nWords seen: ${unique}\nDue now: ${due}\nAccuracy: ${
        total ? Math.round((profile.correct / total) * 100) : 0
      }%\nStars: ${profile.stars} ⭐\nBond: ${profile.bond} ♡\n`,
    )
}

function showTodos(config, profile) {
  const todos = activeTodos(profile)
  if (!todos.length) return console.log(config.language === 'zh-CN' ? '\n今天的任务都完成啦 ✦\n' : '\nEverything is complete for today ✦\n')
  console.log(config.language === 'zh-CN' ? '\n同行计划\n' : '\nTogether Plan\n')
  todos.forEach((todo, index) => console.log(`  [${index + 1}] ${todo.text}`))
  console.log('')
}

async function interactive(rl, config, profile) {
  clear()
  console.log(logo())
  showPet(config, profile)
  const action = await choose(rl, config.language === 'zh-CN' ? '今天想做什么？' : 'What shall we do today?', [
    { label: config.language === 'zh-CN' ? '今日练习' : 'Practice', value: 'learn' },
    { label: config.language === 'zh-CN' ? '喂养宠物' : 'Feed pet', value: 'feed' },
    { label: config.language === 'zh-CN' ? '和宠物玩' : 'Play together', value: 'play' },
    { label: config.language === 'zh-CN' ? '学习记录' : 'Progress', value: 'status' },
    { label: config.language === 'zh-CN' ? '离开' : 'Exit', value: 'exit' },
  ])
  return action
}

export async function run(args) {
  if (args.includes('--help') || args[0] === 'help') return help()
  if (args.includes('--version') || args[0] === 'version') return console.log(VERSION)
  if (args[0] === 'config') {
    await setup()
    return
  }
  let config = (await loadConfig()) || (await setup())
  if (!config) return
  config = { ...config, accent: config.accent === 'uk' ? 'uk' : 'us' }
  const profile = await loadProfile()
  syncLearningTodo(profile, config.language)
  if (!args.length && stdin.isTTY) {
    const { runTui } = await import('./tui.mjs')
    await runTui(config, profile, { saveConfig, saveProfile })
    return
  }
  const rl = createPrompt()
  let command = args[0]
  let running = true
  while (running) {
    if (!command) command = await interactive(rl, config, profile)
    if (command === 'learn') {
      const result = await learn(rl, config, profile, args[1])
      console.log(`${paint(colors.yellow, `${result.correct}/${result.count}`)} · ${currentPet(config).name} is proud of you.`)
    } else if (command === 'pet') showPet(config, profile)
    else if (command === 'feed') {
      const message = feed(config, profile, config.language)
      await animatePet(config, { action: 'feed', message })
      console.log('')
    } else if (command === 'play') {
      const message = play(config, profile, config.language)
      await animatePet(config, { action: 'play', message })
      console.log('')
    } else if (command === 'status') await status(config, profile)
    else if (command === 'todo') {
      const action = args[1] || 'list'
      if (action === 'add') {
        const text = args.slice(2).join(' ').trim()
        if (text) addTodo(profile, text)
        else console.log(config.language === 'zh-CN' ? '\n请填写任务内容。\n' : '\nPlease provide a task.\n')
      } else if (action === 'done') {
        const completed = completeTodo(profile, Number(args[2]))
        if (!completed) console.log(config.language === 'zh-CN' ? '\n没有找到这个任务。\n' : '\nTask not found.\n')
      }
      syncLearningTodo(profile, config.language)
      showTodos(config, profile)
    } else if (command === 'reminder') {
      const action = args[1] || 'status'
      let success
      if (action === 'install') success = await installReminder({ hour: parseReminderHour(args[2]) })
      else if (action === 'remove') success = await removeReminder()
      else success = await reminderStatus()
      const message =
        action === 'status'
          ? success
            ? config.language === 'zh-CN'
              ? '每日提醒已开启。'
              : 'Daily reminder is enabled.'
            : config.language === 'zh-CN'
            ? '每日提醒尚未开启。'
            : 'Daily reminder is not enabled.'
          : success
          ? config.language === 'zh-CN'
            ? '提醒设置完成。'
            : 'Reminder updated.'
          : config.language === 'zh-CN'
          ? '暂时无法设置系统提醒。'
          : 'Could not update the system reminder.'
      console.log(`\n${message}\n`)
    } else if (command === 'remind') {
      const due = dueWordCount(profile)
      let message =
        config.language === 'zh-CN'
          ? `${currentPet(config).name} 在等你。今天用几分钟${due ? `复习 ${due} 个单词` : '学几个新单词'}吧。`
          : `${currentPet(config).name} is waiting. Take a few minutes to ${due ? `review ${due} words` : 'learn a few new words'} today.`
      if (config.invitationCode) {
        try {
          const { askCoach } = await import('./ai.mjs')
          message =
            (await askCoach(config, profile, `Write one gentle daily learning reminder under 24 words. ${due} words are due.`)) || message
        } catch {}
      }
      await notify(message)
    } else if (command === 'summary') {
      try {
        const { askCoach } = await import('./ai.mjs')
        const summary = await askCoach(
          config,
          profile,
          'Review my recent learning, celebrate one concrete win, identify one weakness, and give me a tiny plan for the next session.',
        )
        console.log(`\n${summary || `${currentPet(config).name}: Complete a few sessions and I will help you reflect on them.`}\n`)
      } catch {
        console.log(
          `\n${currentPet(config).name}: ${
            config.language === 'zh-CN'
              ? '今天的总结暂时生成不了，但你的学习记录已经安全保存。'
              : 'Today’s summary is unavailable, but your progress is safely saved.'
          }\n`,
        )
      }
    } else if (command === 'pan')
      console.log(
        '\n╭─────────────────────────────╮\n│ I want to become your idol. │\n│                             │\n│ Made with care by Pan.      │\n╰─────────────────────────────╯\n',
      )
    else if (command === 'exit') running = false
    else help()
    await saveProfile({ ...profile, lastSeenAt: new Date().toISOString() })
    if (args.length) running = false
    command = null
  }
  rl.close()
}
