import { notificationCommand, parseReminderHour, systemdExecArgument } from './reminder.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('notification commands are generated for all supported platforms', () => {
  assert.equal(notificationCommand('study', 'linux')[0], 'notify-send')
  assert.equal(notificationCommand('study', 'darwin')[0], 'osascript')
  const windows = notificationCommand("let's study", 'win32')
  assert.equal(windows[0], 'powershell')
  assert.match(windows[1].join(' '), /ToastNotificationManager/)
})

test('reminder hours accept midnight and reject invalid values', () => {
  assert.equal(parseReminderHour(undefined), 19)
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
