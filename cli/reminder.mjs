import { paths } from './storage.mjs'
import { spawn } from 'node:child_process'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.once('error', () => resolve(false))
    child.once('exit', (code) => resolve(code === 0))
  })
}

export function parseReminderHour(value, fallback = 19) {
  if (value === undefined) return fallback
  const hour = Number(value)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('Reminder hour must be an integer from 0 to 23')
  return hour
}

export function systemdExecArgument(value) {
  const escaped = String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%').replaceAll('\n', '\\n')
  return `"${escaped}"`
}

export function notificationCommand(message, platform = process.platform) {
  if (platform === 'darwin') return ['osascript', ['-e', `display notification ${JSON.stringify(message)} with title "PanwithU"`]]
  if (platform === 'win32') {
    const safe = message.replaceAll("'", "''")
    const script = `$template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02; $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template); $xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('PanwithU')) > $null; $xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode('${safe}')) > $null; [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('PanwithU').Show([Windows.UI.Notifications.ToastNotification]::new($xml))`
    return ['powershell', ['-NoProfile', '-NonInteractive', '-Command', script]]
  }
  return ['notify-send', ['PanwithU', message]]
}

export async function notify(message) {
  const [command, args] = notificationCommand(message)
  return run(command, args)
}

function scheduleFiles(platform = process.platform) {
  if (platform === 'darwin') return [join(homedir(), 'Library', 'LaunchAgents', 'com.panbinghong.panwithu.reminder.plist')]
  if (platform === 'win32') return []
  return [
    join(homedir(), '.config', 'systemd', 'user', 'panwithu-reminder.service'),
    join(homedir(), '.config', 'systemd', 'user', 'panwithu-reminder.timer'),
  ]
}

export async function reminderStatus(platform = process.platform) {
  if (platform === 'win32') return run('schtasks', ['/Query', '/TN', 'PanWithU Daily Reminder'])
  const files = scheduleFiles(platform)
  try {
    await Promise.all(files.map((file) => access(file)))
    return true
  } catch {
    return false
  }
}

export async function installReminder({ hour = 19, minute = 0 } = {}) {
  hour = parseReminderHour(hour)
  const script = process.argv[1]
  if (process.platform === 'win32') {
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    return run('schtasks', [
      '/Create',
      '/F',
      '/SC',
      'DAILY',
      '/ST',
      time,
      '/TN',
      'PanWithU Daily Reminder',
      '/TR',
      `"${process.execPath}" "${script}" remind`,
    ])
  }
  if (process.platform === 'darwin') {
    const [file] = scheduleFiles('darwin')
    await mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true })
    const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.panbinghong.panwithu.reminder</string><key>ProgramArguments</key><array><string>${process.execPath}</string><string>${script}</string><string>remind</string></array><key>StartCalendarInterval</key><dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict></dict></plist>\n`
    await writeFile(file, plist, { mode: 0o600 })
    await run('launchctl', ['bootout', `gui/${process.getuid()}`, file])
    return run('launchctl', ['bootstrap', `gui/${process.getuid()}`, file])
  }
  const [service, timer] = scheduleFiles('linux')
  await mkdir(join(homedir(), '.config', 'systemd', 'user'), { recursive: true })
  await writeFile(
    service,
    `[Unit]\nDescription=PanwithU daily learning reminder\n\n[Service]\nType=oneshot\nExecStart=${systemdExecArgument(
      process.execPath,
    )} ${systemdExecArgument(script)} remind\n`,
    { mode: 0o600 },
  )
  await writeFile(
    timer,
    `[Unit]\nDescription=PanwithU daily learning reminder\n\n[Timer]\nOnCalendar=*-*-* ${String(hour).padStart(2, '0')}:${String(
      minute,
    ).padStart(2, '0')}:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n`,
    { mode: 0o600 },
  )
  await run('systemctl', ['--user', 'daemon-reload'])
  return run('systemctl', ['--user', 'enable', '--now', 'panwithu-reminder.timer'])
}

export async function removeReminder() {
  if (process.platform === 'win32') return run('schtasks', ['/Delete', '/F', '/TN', 'PanWithU Daily Reminder'])
  if (process.platform === 'darwin') {
    const [file] = scheduleFiles('darwin')
    await run('launchctl', ['bootout', `gui/${process.getuid()}`, file])
    await rm(file, { force: true })
    return true
  }
  await run('systemctl', ['--user', 'disable', '--now', 'panwithu-reminder.timer'])
  await Promise.all(scheduleFiles('linux').map((file) => rm(file, { force: true })))
  await run('systemctl', ['--user', 'daemon-reload'])
  return true
}
