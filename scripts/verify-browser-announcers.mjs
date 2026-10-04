import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const preview = spawn('npx', ['vite', 'preview', '--port', '5199'], { stdio: 'pipe', shell: true });

preview.stdout.on('data', async (buf) => {
  const msg = buf.toString();
  if (msg.includes('5199')) {
    console.log('Preview server online on port 5199');
    try {
      const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto('http://localhost:5199', { waitUntil: 'networkidle2' });
      await page.waitForSelector('article', { timeout: 10000 });

      // Click all Broadcast toggle buttons
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const b of buttons) {
          if (b.textContent && b.textContent.includes('Broadcast')) {
            b.click();
          }
        }
      });

      await new Promise((r) => setTimeout(r, 1200));

      const cardData = await page.evaluate(() => {
        const articles = Array.from(document.querySelectorAll('article'));
        return articles.map((art) => {
          const text = art.innerText;
          const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
          const header = lines.slice(0, 3).join(' ');
          const announcerLine = lines.find((l) =>
            l.includes('Nantz') ||
            l.includes('Harlan') ||
            l.includes('Catalon') ||
            l.includes('Pasch') ||
            l.includes('Burkhardt') ||
            l.includes('Brando') ||
            l.includes('Eagle') ||
            l.includes('Dedes') ||
            l.includes('Myers') ||
            l.includes('Lewis') ||
            l.includes('Albert') ||
            l.includes('Kugler') ||
            l.includes('Tirico') ||
            l.includes('Michaels') ||
            l.includes('Buck') ||
            l.includes('Crew TBA')
          ) || 'NOT FOUND';
          const sidelineLine = lines.find((l) => l.startsWith('Sideline:')) || '';
          return { header, announcerLine, sidelineLine };
        });
      });

      console.log('--- EXTRACTED BROWSER BROADCAST PANELS ---');
      cardData.forEach((c, idx) => {
        console.log(`[Card ${idx + 1}] ${c.header}`);
        console.log(`       Booth:    ${c.announcerLine}`);
        if (c.sidelineLine) console.log(`       Sideline: ${c.sidelineLine}`);
      });

      await page.screenshot({ path: 'screenshots/broadcast-announcers-verified.png', fullPage: false });
      console.log('Saved screenshot: screenshots/broadcast-announcers-verified.png');
      await browser.close();
    } catch (err) {
      console.error('Test error:', err);
    } finally {
      preview.kill();
      process.exit(0);
    }
  }
});
