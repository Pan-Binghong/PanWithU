import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

export async function loadDictionaryCatalog() {
  return JSON.parse(await readFile(join(root, 'cli', 'dictionaries.json'), 'utf8'))
}

export async function loadDictionary(dictionary) {
  const words = JSON.parse(await readFile(join(root, 'public', 'dicts', dictionary.file), 'utf8'))
  return words
    .map((word) => ({
      ...word,
      name: String(word.name || ''),
      trans: Array.isArray(word.trans) ? word.trans.map(String) : word.trans == null ? [] : [String(word.trans)],
    }))
    .filter((word) => word.name)
}

export async function loadChapter(dictionary, chapter, chapterLength = 20) {
  const words = await loadDictionary(dictionary)
  const safeChapter = Math.max(0, Math.min(Number(chapter) || 0, Math.max(0, Math.ceil(words.length / chapterLength) - 1)))
  return words.slice(safeChapter * chapterLength, (safeChapter + 1) * chapterLength)
}
