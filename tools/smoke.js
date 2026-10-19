// Headless check of every page: HTTP status, JS errors, failed requests, call button hidden, screenshots.
// Usage: node tools/smoke.js <baseURL> <shotDir>   (needs puppeteer-core + Chrome)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const base = process.argv[2] || 'https://platinum00001.github.io/autonomousboatservice.com/';
const out = process.argv[3] || 'shots';
const pages = ['', 'partners.html', 'staff.html', 'privacy.html', 'terms.html', 'some/missing/page'];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const results = [];
  for (const p of pages) {
    const page = await b.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errs = [], fails = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400 && r.url() !== base + p) fails.push(r.status() + ' ' + r.url()); });
    page.on('requestfailed', (r) => fails.push('failed ' + r.url() + ' ' + (r.failure() || {}).errorText));
    const resp = await page.goto(base + p, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    const name = p === 'some/missing/page' ? '404' : (p || 'index').replace('.html', '');
    const visibleCall = await page.$$eval('[data-call]', (els) => els.filter((e) => e.offsetParent !== null).length);
    const cssOk = await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)');
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    if (p === '') { await page.setViewport({ width: 390, height: 844, isMobile: true }); await new Promise((r) => setTimeout(r, 400)); await page.screenshot({ path: `${out}/index-mobile.png`, fullPage: true }); }
    results.push({ page: p || 'index', status: resp.status(), title: await page.title(), cssOk, visibleCallButtons: visibleCall, errors: errs, failed: fails });
    await page.close();
  }
  await b.close();
  console.log(JSON.stringify(results, null, 1));
  fs.writeFileSync(out + '/live-check.json', JSON.stringify(results, null, 1));
})();
