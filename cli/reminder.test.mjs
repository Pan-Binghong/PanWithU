import {
  macNotificationAppPath,
  NOTIFICATION_APP_NAME,
  NOTIFICATION_LOGO_PATH,
  WINDOWS_NOTIFICATION_APP_ID,
  notificationCommand,
  parseReminderHour,
  systemdExecArgument,
  windowsLauncherScript,
  windowsNotificationArgs,
  windowsNotificationIconPath,
  windowsSnoreToastPath,
} from './reminder.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('notification commands are generated for all supported platforms', () => {
  assert.deepEqual(notificationCommand('study', 'linux', 'Mimi')[1], [
    '--app-name',
    'Pan',
    '--icon',
    NOTIFICATION_LOGO_PATH,
    'Mimi',
    'study',
  ])
  assert.deepEqual(notificationCommand('study', 'darwin', 'Mimi'), [
    'open',
    ['-n', '-a', macNotificationAppPath(), '--args', 'study', 'Mimi'],
  ])
  const windows = notificationCommand("let's study", 'win32')
  assert.match(windows[0], /snoretoast-x(?:64|86)\.exe$/)
  assert.deepEqual(windows[1], windowsNotificationArgs("let's study", 'PanwithU'))
  assert.match(windowsNotificationIconPath('C:\\Users\\Pan\\AppData\\Local'), /pan-notification-256\.png$/)
  assert.match(windowsSnoreToastPath('x64'), /snoretoast-x64\.exe$/)
  assert.equal(windows[1].at(-1), WINDOWS_NOTIFICATION_APP_ID)
  assert.match(NOTIFICATION_LOGO_PATH, /panwithu-logo\.png$/)
  assert.equal(NOTIFICATION_APP_NAME, 'Pan')
})

test('reminder hours accept midnight and reject invalid values', () => {
  assert.equal(parseReminderHour(undefined), 12)
  assert.equal(parseReminderHour('0'), 0)
  assert.equal(parseReminderHour('23'), 23)
  assert.throws(() => parseReminderHour('24'), /0 to 23/)
  assert.throws(() => parseReminderHour('-1'), /0 to 23/)
  assert.throws(() => parseReminderHour('noon'), /0 to 23/)
})

test('systemd reminder command arguments preserve special paths', () => {
  assert.equal(systemdExecArgument('/opt/Pan With U/node'), '"/opt/Pan With U/node"')
  assert.equal(systemdExecArgument('/opt/100%/pwu"cli'), '"/opt/100%%/pwu\\"cli"')
})

test('Windows scheduled tasks launch the CLI without a visible terminal', () => {
  const launcher = windowsLauncherScript('C:\\Program Files\\nodejs\\node.exe', 'C:\\Users\\Pan Binghong\\pwu.mjs', 'pull-notifications')
  assert.match(launcher, /WScript\.Shell/)
  assert.match(launcher, /pull-notifications", 0, False/)
  assert.doesNotMatch(launcher, /powershell/i)
})
