#!/usr/bin/env node
import { execSync } from 'node:child_process'

function run(cmd) {
  return execSync(cmd, { stdio: 'inherit' })
}

function getOutput(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

try {
  console.log('🔄 Checking repository status...')
  run('git add -A')
  
  const status = getOutput('git status --porcelain')
  if (!status) {
    console.log('✨ Working tree is already clean. Nothing to commit.')
    process.exit(0)
  }

  const customMsg = process.argv.slice(2).join(' ').trim()
  const commitMsg = customMsg || `feat: streamline field radar layout and component hierarchy (${new Date().toISOString().slice(0, 10)})`

  console.log(`📦 Committing changes: "${commitMsg}"...`)
  run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`)

  console.log('🚀 Pushing to origin main...')
  run('git push origin main')
  console.log('🎉 Successfully synced changes to GitHub!')
} catch (error) {
  console.error('❌ Sync failed:', error.message)
  process.exit(1)
}
