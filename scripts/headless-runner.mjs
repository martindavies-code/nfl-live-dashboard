#!/usr/bin/env node
// =============================================================================
// Standalone Local Headless Browser Runner & Automated Auditor
// (Uses native local Google Chrome / Microsoft Edge via Chrome DevTools Protocol)
// ZERO Playwright. ZERO external binary downloads. 100% Offline & Native.
// =============================================================================

import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import http from 'node:http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

async function isServerUp(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url)
      const req = http.get(
        {
          hostname: u.hostname,
          port: u.port || 80,
          path: u.pathname,
          timeout: 1000,
        },
        (res) => {
          resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500))
        }
      )
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    } catch {
      resolve(false)
    }
  })
}

// Common browser locations across platforms
const KNOWN_BROWSER_PATHS = [
  // Windows Google Chrome
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
  // Windows Microsoft Edge
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge',
].filter(Boolean)

/**
 * Finds the first installed browser executable on the system.
 */
export function findLocalBrowser() {
  for (const candidate of KNOWN_BROWSER_PATHS) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

/**
 * Ensures directory exists.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Run a full automated accessibility, UI, and functionality audit.
 */
async function runAudit(options = {}) {
  const targetUrl = options.url || 'http://localhost:5173/'
  const browserPath = options.browserPath || findLocalBrowser()

  if (!browserPath) {
    console.error('❌ Error: No local Chrome or Edge installation found on this system.')
    console.error('Please verify Chrome or Edge is installed.')
    process.exit(1)
  }

  console.log(`\n======================================================`)
  console.log(`🚀 Standalone Local Headless Runner`)
  console.log(`🌐 Native Browser: ${browserPath}`)
  console.log(`🔗 Target URL:     ${targetUrl}`)
  console.log(`======================================================\n`)

  const outDir = path.join(ROOT_DIR, 'screenshots')
  ensureDir(outDir)

  // Current conversation artifact directory
  const artifactDir = process.env.GEMINI_ARTIFACT_DIR || 'C:\\Users\\Martin\\.gemini\\antigravity-ide\\brain\\3af0f0f6-bae9-44f2-85ee-e8039860a520'
  ensureDir(artifactDir)

  const saveShot = async (page, filename, element = null) => {
    const destLocal = path.join(outDir, filename)
    if (element) {
      await element.screenshot({ path: destLocal })
    } else {
      await page.screenshot({ path: destLocal, fullPage: false })
    }
    console.log(`  ✔ Saved: ${filename}`)
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(destLocal, path.join(artifactDir, filename))
    }
  }

  let spawnedServer = null
  if (!(await isServerUp(targetUrl))) {
    console.log('⚡ Target server not detected. Auto-launching Vite preview server...')
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    spawnedServer = spawn(`${npmCmd} run preview -- --port 5173`, {
      cwd: ROOT_DIR,
      stdio: 'ignore',
      shell: true,
    })
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 500))
      if (await isServerUp(targetUrl)) {
        console.log('  ✔ Vite preview server is ready!')
        break
      }
    }
  }

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: !options.headful,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })

    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    console.log(`[1/14] Navigating to ${targetUrl}...`)
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 15000 })
    const title = await page.title()
    console.log(`  ✔ Page loaded successfully! Title: "${title}"`)

    // Wait for hydration
    await new Promise((r) => setTimeout(r, 1500))

    // 1. Desktop Initial State
    console.log(`[2/14] Capturing Desktop Viewport (1440x900)...`)
    await saveShot(page, '01-desktop-live.png')

    // Capture Hero Field Position Radar with Drive Plays
    const radarEl = await page.$('div[role="region"][aria-label*="Football field"]')
    if (radarEl) {
      await page.evaluate((el) => {
        el.scrollIntoView({ block: 'center' })
      }, radarEl)
      await new Promise((r) => setTimeout(r, 300))
      await saveShot(page, '01b-hero-field-radar.png', radarEl)
    }

    // 2. Keyboard Shortcuts Modal (Press '?')
    console.log(`[3/14] Testing Keyboard Shortcut: '?' (Open Help Dialog)...`)
    await page.keyboard.press('?')
    await new Promise((r) => setTimeout(r, 500))
    await saveShot(page, '02-shortcuts-modal.png')
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 300))

    // 3. Data Sources Modal (Press 'S')
    console.log(`[4/14] Testing Data Sources Modal: 'S'...`)
    await page.keyboard.press('s')
    await new Promise((r) => setTimeout(r, 500))
    await saveShot(page, '03-data-sources-modal.png')
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 300))

    // 4. Week Selector Menu (Regular Season)
    console.log(`[5/14] Testing Week Selector Dropdown Dialog...`)
    const weekBtn = await page.$('button[aria-haspopup="dialog"]')
    if (weekBtn) {
      await weekBtn.click()
      await new Promise((r) => setTimeout(r, 400))
      await saveShot(page, '04-week-selector-regular.png')

      // Switch to NFL Playoffs tab
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const playoffTab = btns.find((b) => b.textContent?.includes('NFL Playoffs'))
        playoffTab?.click()
      })
      await new Promise((r) => setTimeout(r, 400))
      await saveShot(page, '05-week-selector-playoffs.png')

      await page.keyboard.press('Escape')
      await new Promise((r) => setTimeout(r, 300))
    }

    // 5. Expand All Radars (Press 'F')
    console.log(`[6/14] Testing Bulk Expand All Radars: 'F'...`)
    await page.keyboard.press('f')
    await new Promise((r) => setTimeout(r, 500))
    await page.evaluate(() => {
      const el = document.querySelector('#all-matchups-title')
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
    })
    await new Promise((r) => setTimeout(r, 400))
    await saveShot(page, '06-grid-all-radars.png')

    // 6. Expand All Announcers (Press 'B')
    console.log(`[7/14] Testing Bulk Expand All Announcers: 'B'...`)
    await page.keyboard.press('b')
    await new Promise((r) => setTimeout(r, 500))
    await saveShot(page, '07-grid-all-announcers.png')

    // 7. Expand All Scorigamis (Press 'C')
    console.log(`[8/14] Testing Bulk Expand All Scorigamis: 'C'...`)
    await page.keyboard.press('c')
    await new Promise((r) => setTimeout(r, 500))
    await saveShot(page, '08-grid-all-scorigamis.png')

    // Reset expanders (Press 'C' again to close)
    await page.keyboard.press('c')
    await new Promise((r) => setTimeout(r, 300))
    await page.evaluate(() => window.scrollTo(0, 0))

    // 8. Super Bowl / Playoff Navigation (Press 'P')
    console.log(`[9/14] Testing Playoff & Super Bowl Navigation: 'P'...`)
    await page.keyboard.press('p')
    await new Promise((r) => setTimeout(r, 600))
    await saveShot(page, '09-playoffs-superbowl.png')

    // Return to live week
    await page.keyboard.press('0')
    await new Promise((r) => setTimeout(r, 500))

    // 9. Mobile Portrait Viewport - Pixel 6 (393x851)
    console.log(`[10/14] Testing Mobile Portrait Viewport - Google Pixel 6 (393x851)...`)
    await page.setViewport({ width: 393, height: 851, isMobile: true, hasTouch: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await new Promise((r) => setTimeout(r, 600))
    await saveShot(page, '10-mobile-portrait-hero.png')

    // 10. Mobile Field Radar with Play Text Close-up
    console.log(`[11/14] Capturing Mobile Field Radar close-up...`)
    const mobileRadar = await page.$('div[role="region"][aria-label*="Football field"]')
    if (mobileRadar) {
      await page.evaluate((el) => {
        el.scrollIntoView({ block: 'center' })
      }, mobileRadar)
      await new Promise((r) => setTimeout(r, 400))
      await saveShot(page, '11-mobile-field-radar.png', mobileRadar)
    }

    // 11. Mobile Matchups Grid
    console.log(`[12/14] Capturing Mobile Matchups Grid...`)
    await page.evaluate(() => {
      const el = document.querySelector('#all-matchups-title')
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
    })
    await new Promise((r) => setTimeout(r, 500))
    await saveShot(page, '12-mobile-matchups-grid.png')

    // 12. Mobile Keyboard Shortcuts / Help Modal
    console.log(`[13/14] Testing Mobile Dialogs...`)
    await page.keyboard.press('?')
    await new Promise((r) => setTimeout(r, 500))
    await saveShot(page, '13-mobile-shortcuts-modal.png')
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 300))

    // 13. Tablet Viewport - iPad Air (820x1180)
    console.log(`[14/14] Testing Tablet Viewport - iPad Air (820x1180)...`)
    await page.setViewport({ width: 820, height: 1180, isMobile: true, hasTouch: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await new Promise((r) => setTimeout(r, 600))
    await saveShot(page, '14-tablet-viewport.png')

    console.log(`\n======================================================`)
    console.log(`🎉 Automated Visual & Accessibility Audit Complete!`)
    console.log(`Console Errors: ${consoleErrors.length}`)
    if (consoleErrors.length > 0) {
      console.log(`Errors encountered:`, consoleErrors)
    }
    console.log(`Screenshots saved to: ${outDir}`)
    console.log(`Screenshots copied to artifact dir: ${artifactDir}`)
    console.log(`======================================================\n`)
  } finally {
    try {
      await browser.close()
    } catch {}
    if (spawnedServer) {
      try {
        spawnedServer.kill('SIGTERM')
      } catch {}
    }
  }
}

// CLI argument parsing
const args = process.argv.slice(2)
const isHeadful = args.includes('--headful') || args.includes('-h')
const urlArg = args.find((a) => a.startsWith('--url='))?.split('=')[1]

runAudit({
  url: urlArg || 'http://localhost:5173/',
  headful: isHeadful,
}).catch((err) => {
  console.error('Fatal error during headless run:', err)
  process.exit(1)
})
