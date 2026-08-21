#!/usr/bin/env node
import { run } from '../cli/app.mjs'

run(process.argv.slice(2)).catch((error) => {
  console.error(`\nPanwithU: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
