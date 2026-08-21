import { AI_BASE_URLS } from './constants.mjs'

let workingBaseUrl = null

export function apiBaseUrls() {
  if (!workingBaseUrl) return [...AI_BASE_URLS]
  return [workingBaseUrl, ...AI_BASE_URLS.filter((url) => url !== workingBaseUrl)]
}

export function rememberApiBaseUrl(url) {
  if (AI_BASE_URLS.includes(url)) workingBaseUrl = url
}
