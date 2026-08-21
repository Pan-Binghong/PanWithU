import { userInfo } from 'node:os'

export function normalizeSystemUsername(value) {
  if (typeof value !== 'string') return null
  const name = value
    .trim()
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  return name || null
}

export function systemUsername() {
  try {
    return normalizeSystemUsername(userInfo().username)
  } catch {
    return null
  }
}
