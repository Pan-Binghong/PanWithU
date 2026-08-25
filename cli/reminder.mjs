import { paths } from './storage.mjs'
import { spawn } from 'node:child_process'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const NOTIFICATION_APP_NAME = 'Pan'

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.once('error', () => resolve(false))
    child.once('exit', (code) => resolve(code === 0))
  })
}

export function parseReminderHour(value, fallback = 12) {
  if (value === undefined) return fallback
  const hour = Number(value)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('Reminder hour must be an integer from 0 to 23')
  return hour
}

export function systemdExecArgument(value) {
  const escaped = String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%').replaceAll('\n', '\\n')
  return `"${escaped}"`
}

export function notificationCommand(message, platform = process.platform, title = 'PanwithU') {
  if (platform === 'darwin') return ['open', ['-n', '-a', macNotificationAppPath(), '--args', message, title]]
  if (platform === 'win32') {
    const safe = message.replaceAll("'", "''")
    const safeTitle = title.replaceAll("'", "''")
    const script = `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class PanIdentity { [DllImport("shell32.dll", CharSet = CharSet.Unicode)] public static extern int SetCurrentProcessExplicitAppUserModelID(string appID); }'; [PanIdentity]::SetCurrentProcessExplicitAppUserModelID('${NOTIFICATION_APP_NAME}') > $null; $manager = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]; $toastType = [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]; $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02; $xml = $manager::GetTemplateContent($template); $xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${safeTitle}')) > $null; $xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode('${safe}')) > $null; $manager::CreateToastNotifier('${NOTIFICATION_APP_NAME}').Show($toastType::new($xml))`
    return ['powershell', ['-NoProfile', '-NonInteractive', '-Command', script]]
  }
  return ['notify-send', ['--app-name', NOTIFICATION_APP_NAME, title, message]]
}

export async function notify(message, { title = 'PanwithU' } = {}) {
  if (process.platform === 'darwin' && !(await ensureMacNotificationApp())) return false
  const [command, args] = notificationCommand(message, process.platform, title)
  return run(command, args)
}

export function macNotificationAppPath(home = homedir()) {
  return join(home, 'Library', 'Application Support', 'PanWithU', `${NOTIFICATION_APP_NAME}.app`)
}

async function ensureMacNotificationApp() {
  const app = macNotificationAppPath()
  try {
    await access(app)
    return true
  } catch {}
  await mkdir(join(homedir(), 'Library', 'Application Support', 'PanWithU'), { recursive: true })
  const script = `on run argv
set notificationMessage to item 1 of argv
set notificationTitle to item 2 of argv
display notification notificationMessage with title notificationTitle
end run`
  return run('osacompile', ['-o', app, '-e', script])
}

function scheduleFiles(platform = process.platform) {
  if (platform === 'darwin') return [join(homedir(), 'Library', 'LaunchAgents', 'com.panbinghong.panwithu.reminder.plist')]
  if (platform === 'win32') return []
  return [
    join(homedir(), '.config', 'systemd', 'user', 'panwithu-reminder.service'),
    join(homedir(), '.config', 'systemd', 'user', 'panwithu-reminder.timer'),
  ]
}

function remoteNotificationScheduleFiles(platform = process.platform) {
  if (platform === 'darwin') return [join(homedir(), 'Library', 'LaunchAgents', 'com.panbinghong.panwithu.remote-notifications.plist')]
  if (platform === 'win32') return []
  return [
    join(homedir(), '.config', 'systemd', 'user', 'panwithu-remote-notifications.service'),
    join(homedir(), '.config', 'systemd', 'user', 'panwithu-remote-notifications.timer'),
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

export async function installReminder({ hour = 12, minute = 0, intervalMinutes = null } = {}) {
  hour = parseReminderHour(hour)
  const interval = intervalMinutes == null ? null : Math.max(1, Math.floor(Number(intervalMinutes)))
  const script = process.argv[1]
  if (process.platform === 'win32') {
    const schedule = interval
      ? ['/SC', 'MINUTE', '/MO', String(interval)]
      : ['/SC', 'DAILY', '/ST', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`]
    return run('schtasks', [
      '/Create',
      '/F',
      ...schedule,
      '/TN',
      'PanWithU Daily Reminder',
      '/TR',
      `"${process.execPath}" "${script}" remind`,
    ])
  }
  if (process.platform === 'darwin') {
    const [file] = scheduleFiles('darwin')
    await mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true })
    const schedule = interval
      ? `<key>StartInterval</key><integer>${interval * 60}</integer>`
      : `<key>StartCalendarInterval</key><dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict>`
    const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.panbinghong.panwithu.reminder</string><key>ProgramArguments</key><array><string>${process.execPath}</string><string>${script}</string><string>remind</string></array>${schedule}</dict></plist>\n`
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
    interval
      ? `[Unit]\nDescription=PanwithU companion check\n\n[Timer]\nOnBootSec=2min\nOnUnitActiveSec=${interval}min\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n`
      : `[Unit]\nDescription=PanwithU daily learning reminder\n\n[Timer]\nOnCalendar=*-*-* ${String(hour).padStart(2, '0')}:${String(
          minute,
        ).padStart(2, '0')}:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n`,
    { mode: 0o600 },
  )
  await run('systemctl', ['--user', 'daemon-reload'])
  return run('systemctl', ['--user', 'enable', '--now', 'panwithu-reminder.timer'])
}

export async function installRemoteNotificationPolling({ intervalMinutes = 5 } = {}) {
  const interval = Math.max(1, Math.floor(Number(intervalMinutes)))
  const script = process.argv[1]
  if (process.platform === 'win32') {
    return run('schtasks', [
      '/Create',
      '/F',
      '/SC',
      'MINUTE',
      '/MO',
      String(interval),
      '/TN',
      'Pan Remote Notifications',
      '/TR',
      `"${process.execPath}" "${script}" pull-notifications`,
    ])
  }
  if (process.platform === 'darwin') {
    const [file] = remoteNotificationScheduleFiles('darwin')
    await mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true })
    const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.panbinghong.panwithu.remote-notifications</string><key>ProgramArguments</key><array><string>${
      process.execPath
    }</string><string>${script}</string><string>pull-notifications</string></array><key>StartInterval</key><integer>${
      interval * 60
    }</integer></dict></plist>\n`
    await writeFile(file, plist, { mode: 0o600 })
    await run('launchctl', ['bootout', `gui/${process.getuid()}`, file])
    return run('launchctl', ['bootstrap', `gui/${process.getuid()}`, file])
  }
  const [service, timer] = remoteNotificationScheduleFiles('linux')
  await mkdir(join(homedir(), '.config', 'systemd', 'user'), { recursive: true })
  await writeFile(
    service,
    `[Unit]\nDescription=Pan remote notifications\n\n[Service]\nType=oneshot\nExecStart=${systemdExecArgument(
      process.execPath,
    )} ${systemdExecArgument(script)} pull-notifications\n`,
    { mode: 0o600 },
  )
  await writeFile(
    timer,
    `[Unit]\nDescription=Pan remote notification polling\n\n[Timer]\nOnBootSec=1min\nOnUnitActiveSec=${interval}min\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n`,
    { mode: 0o600 },
  )
  await run('systemctl', ['--user', 'daemon-reload'])
  return run('systemctl', ['--user', 'enable', '--now', 'panwithu-remote-notifications.timer'])
}

export async function removeReminder() {
  if (process.platform === 'win32') {
    const reminder = await run('schtasks', ['/Delete', '/F', '/TN', 'PanWithU Daily Reminder'])
    await run('schtasks', ['/Delete', '/F', '/TN', 'Pan Remote Notifications'])
    return reminder
  }
  if (process.platform === 'darwin') {
    const [file] = scheduleFiles('darwin')
    const [remoteFile] = remoteNotificationScheduleFiles('darwin')
    await run('launchctl', ['bootout', `gui/${process.getuid()}`, file])
    await run('launchctl', ['bootout', `gui/${process.getuid()}`, remoteFile])
    await rm(file, { force: true })
    await rm(remoteFile, { force: true })
    return true
  }
  await run('systemctl', ['--user', 'disable', '--now', 'panwithu-reminder.timer'])
  await run('systemctl', ['--user', 'disable', '--now', 'panwithu-remote-notifications.timer'])
  await Promise.all(scheduleFiles('linux').map((file) => rm(file, { force: true })))
  await Promise.all(remoteNotificationScheduleFiles('linux').map((file) => rm(file, { force: true })))
  await run('systemctl', ['--user', 'daemon-reload'])
  return true
}
