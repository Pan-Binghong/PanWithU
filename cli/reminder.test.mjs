import {
  macNotificationAppPath,
  NOTIFICATION_APP_NAME,
  NOTIFICATION_LOGO_PATH,
  notificationCommand,
  parseReminderHour,
  systemdExecArgument,
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
  assert.equal(windows[0], 'powershell')
  assert.match(windows[1].join(' '), /ToastNotificationManager/)
  assert.match(windows[1].join(' '), /SetCurrentProcessExplicitAppUserModelID\('Pan'\)/)
  assert.match(windows[1].join(' '), /appLogoOverride/)
  assert.match(windows[1].join(' '), /256, 256/)
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
