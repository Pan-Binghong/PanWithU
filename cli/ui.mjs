import { stdin, stdout } from 'node:process'
import readline from 'node:readline/promises'

export const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
  pink: '\x1b[35m',
  red: '\x1b[31m',
}

export function paint(color, text) {
  return stdout.isTTY ? `${color}${text}${colors.reset}` : text
}

export function clear() {
  if (stdout.isTTY) stdout.write('\x1b[2J\x1b[H')
}

export function logo() {
  return paint(
    colors.cyan,
    String.raw`
  PanwithU  ✦  learn English, grow together
`,
  )
}

export function createPrompt() {
  return readline.createInterface({ input: stdin, output: stdout })
}

export async function choose(rl, title, choices) {
  console.log(`\n${title}`)
  choices.forEach((choice, index) => console.log(`  ${paint(colors.cyan, `[${index + 1}]`)} ${choice.label}`))
  while (true) {
    const answer = (await rl.question('> ')).trim()
    const index = Number(answer) - 1
    if (Number.isInteger(index) && choices[index]) return choices[index].value
  }
}

export async function secretQuestion(label) {
  if (!stdin.isTTY) return ''
  stdout.write(label)
  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf8')
  let value = ''
  return new Promise((resolve) => {
    const onData = (char) => {
      if (char === '\u0003') process.exit(130)
      if (char === '\r' || char === '\n') {
        stdin.off('data', onData)
        stdin.setRawMode(false)
        stdout.write('\n')
        resolve(value.trim())
      } else if (char === '\u007f') {
        if (value) {
          value = value.slice(0, -1)
          stdout.write('\b \b')
        }
      } else if (char >= ' ') {
        value += char
        stdout.write('•')
      }
    }
    stdin.on('data', onData)
  })
}
