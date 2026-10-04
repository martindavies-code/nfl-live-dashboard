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

  // Current artifact directory
  const artifactDir = 'C:\\Users\\Martin\\.gemini\\antigravity-ide\\brain\\f8fb1880-542c-4b0d-9418-fa1e3678d497'

  let spawnedServer = null
  if (!(await isServerUp(targetUrl))) {
    console.log('⚡ Target server not detected. Auto-launching Vite preview server...')
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    spawnedServer = spawn(`${npmCmd} run preview -- --port 5173`, {
      cwd: ROOT_DIR,
      stdio: 'ignore',
      shell: true,
    })
    for (let i = 0; i < 20; i++) {
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

    console.log(`[1/6] Navigating to ${targetUrl}...`)
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 15000 })

    const title = await page.title()
    console.log(`  ✔ Page loaded successfully! Title: "${title}"`)

    // Wait 1.5 seconds for mock/live data hydration
    await new Promise((r) => setTimeout(r, 1500))

    // 1. Desktop Initial State Screenshot
    console.log(`[2/6] Capturing Desktop Viewport (1440x900)...`)
    const desktopPath = path.join(outDir, '01-desktop-live.png')
    await page.screenshot({ path: desktopPath, fullPage: false })
    console.log(`  ✔ Saved: ${desktopPath}`)
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(desktopPath, path.join(artifactDir, '01-desktop-live.png'))
    }

    // 2. Test Keyboard Shortcuts Modal (Press '?')
    console.log(`[3/6] Testing Keyboard Shortcut: '?' (Open Help Dialog)...`)
    await page.keyboard.press('?')
    await new Promise((r) => setTimeout(r, 400))

    const modalVisible = await page.$eval(
      '[role="dialog"]',
      (el) => el !== null && window.getComputedStyle(el).display !== 'none'
    ).catch(() => false)

    if (modalVisible) {
      console.log(`  ✔ Modal dialog opened successfully with role="dialog"!`)
      const modalPath = path.join(outDir, '02-shortcuts-modal.png')
      await page.screenshot({ path: modalPath, fullPage: false })
      console.log(`  ✔ Saved: ${modalPath}`)
      if (fs.existsSync(artifactDir)) {
        fs.copyFileSync(modalPath, path.join(artifactDir, '02-shortcuts-modal.png'))
      }
    } else {
      console.log(`  ⚠️ Notice: Modal element not immediately found via query.`)
    }

    // Dismiss modal with Escape key
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 300))

    // 3. Test High-Contrast Pro Mode (Press 'H')
    console.log(`[4/6] Testing High-Contrast Pro Mode: 'H'...`)
    await page.keyboard.press('h')
    await new Promise((r) => setTimeout(r, 400))

    const isHighContrast = await page.evaluate(() =>
      document.documentElement.classList.contains('high-contrast-pro')
    )
    console.log(`  ✔ High-Contrast Pro class active: ${isHighContrast}`)

    const contrastPath = path.join(outDir, '03-high-contrast-mode.png')
    await page.screenshot({ path: contrastPath, fullPage: false })
    console.log(`  ✔ Saved: ${contrastPath}`)
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(contrastPath, path.join(artifactDir, '03-high-contrast-mode.png'))
    }

    // Toggle high-contrast back off
    await page.keyboard.press('h')
    await new Promise((r) => setTimeout(r, 300))

    // 4. Test Data Redundancy Modal (Press 'S')
    console.log(`[5/7] Testing Data Redundancy Modal: 'S'...`)
    await page.keyboard.press('s')
    await new Promise((r) => setTimeout(r, 600))

    const simPath = path.join(outDir, '04-simulation-radar.png')
    await page.screenshot({ path: simPath, fullPage: false })
    console.log(`  ✔ Saved: ${simPath}`)
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(simPath, path.join(artifactDir, '04-simulation-radar.png'))
    }

    // Dismiss redundancy modal with Escape
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 300))

    // 5. Test Synchronized Field Radars (Press 'F')
    console.log(`[6/7] Testing Synchronized Field Radars: 'F'...`)
    await page.keyboard.press('f')
    await new Promise((r) => setTimeout(r, 600))

    // Scroll to the All Matchups grid section so all 3 cards in row are clearly visible
    await page.evaluate(() => {
      const el = document.querySelector('#all-matchups-title')
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
    })
    await new Promise((r) => setTimeout(r, 400))

    const gridRadarPath = path.join(outDir, '07-grid-all-radars.png')
    await page.screenshot({ path: gridRadarPath, fullPage: false })
    console.log(`  ✔ Saved: ${gridRadarPath}`)
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(gridRadarPath, path.join(artifactDir, '07-grid-all-radars.png'))
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0))
    await new Promise((r) => setTimeout(r, 300))

    // 6. Test Week & Playoff Navigation: Open Week Selector Popover
    console.log(`[7/9] Testing Week Selector Dropdown Dialog...`)
    const weekBtn = await page.$('button[aria-haspopup="dialog"]')
    if (weekBtn) {
      await weekBtn.click()
      await new Promise((r) => setTimeout(r, 400))
      const weekMenuPath = path.join(outDir, '08-week-selector-menu.png')
      await page.screenshot({ path: weekMenuPath, fullPage: false })
      console.log(`  ✔ Saved: ${weekMenuPath}`)
      if (fs.existsSync(artifactDir)) {
        fs.copyFileSync(weekMenuPath, path.join(artifactDir, '08-week-selector-menu.png'))
      }

      // Switch to NFL Playoffs tab in dialog
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const playoffTab = btns.find((b) => b.textContent?.includes('NFL Playoffs'))
        playoffTab?.click()
      })
      await new Promise((r) => setTimeout(r, 400))

      const playoffMenuPath = path.join(outDir, '08b-playoffs-tab-menu.png')
      await page.screenshot({ path: playoffMenuPath, fullPage: false })
      console.log(`  ✔ Saved: ${playoffMenuPath}`)
      if (fs.existsSync(artifactDir)) {
        fs.copyFileSync(playoffMenuPath, path.join(artifactDir, '08b-playoffs-tab-menu.png'))
      }

      // Close dropdown with Escape
      await page.keyboard.press('Escape')
      await new Promise((r) => setTimeout(r, 300))
    }

    // 7. Test NFL Playoffs & Super Bowl Navigation (Press 'P')
    console.log(`[8/9] Testing NFL Playoffs & Super Bowl Navigation: 'P'...`)
    await page.keyboard.press('p')
    await new Promise((r) => setTimeout(r, 600))

    const playoffPath = path.join(outDir, '09-playoffs-superbowl.png')
    await page.screenshot({ path: playoffPath, fullPage: false })
    console.log(`  ✔ Saved: ${playoffPath}`)
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(playoffPath, path.join(artifactDir, '09-playoffs-superbowl.png'))
    }

    // Return back to live week (Press '0')
    await page.keyboard.press('0')
    await new Promise((r) => setTimeout(r, 400))

    // 8. Test Mobile Responsive Viewport (390x844 iPhone standard)
    console.log(`[9/9] Testing Mobile Responsive Viewport (390x844)...`)
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await page.waitForSelector('#matchups-grid article', { timeout: 4000 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 600))

    const mobilePath = path.join(outDir, '05-mobile-viewport.png')
    await page.screenshot({ path: mobilePath, fullPage: false })
    console.log(`  ✔ Saved: ${mobilePath}`)
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(mobilePath, path.join(artifactDir, '05-mobile-viewport.png'))
    }

    console.log(`\n======================================================`)
    console.log(`🎉 Automated Headless Audit Complete!`)
    console.log(`Console Errors: ${consoleErrors.length}`)
    if (consoleErrors.length > 0) {
      console.log(`Errors encountered:`, consoleErrors)
    }
    console.log(`Screenshots saved to: ${outDir}`)
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
