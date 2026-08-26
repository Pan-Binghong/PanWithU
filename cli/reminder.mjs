import { paths } from './storage.mjs'
import { spawn } from 'node:child_process'
import { access, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const NOTIFICATION_APP_NAME = 'Pan'
export const WINDOWS_NOTIFICATION_APP_ID = 'PanWithU.Pan'
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
export const NOTIFICATION_LOGO_PATH = join(packageRoot, 'assets', 'brand', 'panwithu-logo.png')
const require = createRequire(import.meta.url)

function run(command, args, acceptedExitCodes = [0]) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true })
    child.once('error', () => resolve(false))
    child.once('exit', (code) => resolve(acceptedExitCodes.includes(code)))
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

function vbsString(value) {
  return String(value).replaceAll('"', '""')
}

export function windowsLauncherScript(nodePath, scriptPath, command) {
  return `Set shell = CreateObject("WScript.Shell")\nshell.Run Chr(34) & "${vbsString(nodePath)}" & Chr(34) & " " & Chr(34) & "${vbsString(
    scriptPath,
  )}" & Chr(34) & " ${vbsString(command)}", 0, False\n`
}

async function ensureWindowsLauncher(name, command, script) {
  const supportDir = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'PanWithU')
  const launcher = join(supportDir, name)
  await mkdir(supportDir, { recursive: true })
  await writeFile(launcher, windowsLauncherScript(process.execPath, script, command), { mode: 0o600 })
  return launcher
}

export function notificationCommand(message, platform = process.platform, title = 'PanwithU') {
  if (platform === 'darwin') return ['open', ['-n', '-a', macNotificationAppPath(), '--args', message, title]]
  if (platform === 'win32') return [windowsSnoreToastPath(), windowsNotificationArgs(message, title)]
  return ['notify-send', ['--app-name', NOTIFICATION_APP_NAME, '--icon', NOTIFICATION_LOGO_PATH, title, message]]
}

export async function notify(message, { title = 'PanwithU' } = {}) {
  if (process.platform === 'darwin' && !(await ensureMacNotificationApp())) return false
  if (process.platform === 'win32' && !(await ensureWindowsNotificationSupport())) return false
  const [command, args] = notificationCommand(message, process.platform, title)
  return run(command, args, process.platform === 'win32' ? [0, 1, 2, 3, 4, 5] : [0])
}

export function windowsSnoreToastPath(arch = process.arch) {
  const moduleRoot = dirname(require.resolve('node-notifier/package.json'))
  return join(moduleRoot, 'vendor', 'snoreToast', `snoretoast-${arch === 'x64' ? 'x64' : 'x86'}.exe`)
}

export function windowsNotificationArgs(message, title, iconPath = windowsNotificationIconPath()) {
  return ['-t', title, '-m', message, '-p', iconPath, '-appID', WINDOWS_NOTIFICATION_APP_ID]
}

export function windowsNotificationIconPath(localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')) {
  return join(localAppData, 'PanWithU', 'pan-notification-256.png')
}

async function ensureWindowsNotificationSupport() {
  const iconPath = windowsNotificationIconPath()
  await mkdir(dirname(iconPath), { recursive: true })
  let iconReady = false
  try {
    const info = await stat(iconPath)
    iconReady = info.size <= 200 * 1024
  } catch {}
  if (!iconReady) {
    const source = NOTIFICATION_LOGO_PATH.replaceAll("'", "''")
    const target = iconPath.replaceAll("'", "''")
    const resize = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Drawing; $source=[System.Drawing.Image]::FromFile('${source}'); try { $icon=New-Object System.Drawing.Bitmap 256,256; try { $graphics=[System.Drawing.Graphics]::FromImage($icon); try { $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $graphics.DrawImage($source,0,0,256,256); $icon.Save('${target}',[System.Drawing.Imaging.ImageFormat]::Png) } finally { $graphics.Dispose() } } finally { $icon.Dispose() } } finally { $source.Dispose() }`
    if (!(await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', resize]))) return false
    try {
      if ((await stat(iconPath)).size > 200 * 1024) return false
    } catch {
      return false
    }
  }
  return run(windowsSnoreToastPath(), ['-install', 'PanWithU\\Pan.lnk', process.execPath, WINDOWS_NOTIFICATION_APP_ID])
}

export function macNotificationAppPath(home = homedir()) {
  return join(home, 'Library', 'Application Support', 'PanWithU', `${NOTIFICATION_APP_NAME}.app`)
}

async function ensureMacNotificationApp() {
  const app = macNotificationAppPath()
  const iconMarker = join(app, 'Contents', 'Resources', '.panwithu-logo-v1')
  try {
    await access(iconMarker)
    return true
  } catch {}
  const supportDir = join(homedir(), 'Library', 'Application Support', 'PanWithU')
  await mkdir(supportDir, { recursive: true })
  const script = `on run argv
set notificationMessage to item 1 of argv
set notificationTitle to item 2 of argv
display notification notificationMessage with title notificationTitle
end run`
  if (!(await run('osacompile', ['-o', app, '-e', script]))) return false
  const iconset = join(supportDir, 'Pan.iconset')
  await rm(iconset, { recursive: true, force: true })
  await mkdir(iconset, { recursive: true })
  const sizes = [16, 32, 128, 256, 512]
  for (const size of sizes) {
    if (
      !(await run('sips', ['-z', String(size), String(size), NOTIFICATION_LOGO_PATH, '--out', join(iconset, `icon_${size}x${size}.png`)]))
    )
      return false
    if (
      !(await run('sips', [
        '-z',
        String(size * 2),
        String(size * 2),
        NOTIFICATION_LOGO_PATH,
        '--out',
        join(iconset, `icon_${size}x${size}@2x.png`),
      ]))
    )
      return false
  }
  const icon = join(app, 'Contents', 'Resources', 'applet.icns')
  if (!(await run('iconutil', ['-c', 'icns', iconset, '-o', icon]))) return false
  await writeFile(iconMarker, 'PanWithU notification icon v1\n', { mode: 0o600 })
  await rm(iconset, { recursive: true, force: true })
  return true
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
    const launcher = await ensureWindowsLauncher('daily-reminder.vbs', 'remind', script)
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
      `wscript.exe //B //NoLogo "${launcher}"`,
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
    const launcher = await ensureWindowsLauncher('remote-notifications.vbs', 'pull-notifications', script)
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
      `wscript.exe //B //NoLogo "${launcher}"`,
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
