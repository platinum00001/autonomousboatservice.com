// Headless check of every page: HTTP status, JS errors, failed requests, call button hidden, screenshots.
// Usage: node tools/smoke.js <baseURL> <shotDir>   (needs puppeteer-core + Chrome)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const base = process.argv[2] || 'https://platinum00001.github.io/autonomousboatservice.com/';
const out = process.argv[3] || 'shots';
const pages = ['', 'quote.html', 'parts.html', 'plans.html', 'about.html', 'partners.html', 'account.html', 'lead.html', 'staff.html', 'privacy.html', 'terms.html',
  'services/', 'services/engine-repair.html', 'services/winterization-shrink-wrap.html', 'services/spring-commissioning.html', 'services/hull-fiberglass-gelcoat.html', 'services/bottom-paint.html',
  'services/electrical-electronics.html', 'services/mobile-dockside-service.html', 'services/emergency-haul-out.html', 'services/detailing.html', 'services/storage.html',
  'areas/', 'areas/falmouth.html', 'areas/woods-hole.html', 'areas/mashpee.html', 'areas/bourne.html', 'areas/barnstable-hyannis.html', 'areas/osterville.html', 'areas/dennis.html',
  'areas/harwich.html', 'areas/chatham.html', 'areas/orleans.html', 'areas/marthas-vineyard.html', 'areas/nantucket.html',
  'guides/', 'guides/winterize-outboard-cape-cod.html', 'guides/spring-commissioning-checklist.html', 'guides/bottom-paint-cape-cod-waters.html', 'guides/outboard-wont-start.html',
  'guides/seasonal-maintenance-checklist.html', 'some/missing/page'];
const SHOTS = new Set(['', 'parts.html', 'partners.html', 'services/engine-repair.html', 'areas/falmouth.html', 'guides/', 'plans.html', 'account.html', 'some/missing/page']);
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
    const name = p === 'some/missing/page' ? '404' : (p || 'index').replace('.html', '').replace(/\/$/, '-index').replace(/\//g, '_');
    const visibleCall = await page.$$eval('[data-call]', (els) => els.filter((e) => e.offsetParent !== null).length);
    const cssOk = await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (SHOTS.has(p)) await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    if (p === '' || p === 'services/engine-repair.html') { await page.setViewport({ width: 390, height: 844, isMobile: true }); await new Promise((r) => setTimeout(r, 400)); await page.screenshot({ path: `${out}/${name}-mobile.png`, fullPage: true }); }
    results.push({ page: p || 'index', status: resp.status(), title: await page.title(), cssOk, overflow, visibleCallButtons: visibleCall, errors: errs, failed: fails });
    await page.close();
  }
  await b.close();
  results.forEach((r) => { if (r.page === 'some/missing/page') { r.errors = r.errors.filter((e) => !/404/.test(e)); r.failed = r.failed.filter((f) => !/missing\/page/.test(f)); r.cssOk = r.cssOk && /not found/i.test(r.title); } });
  const bad = results.filter((r) => r.errors.length || r.failed.length || r.overflow || r.visibleCallButtons || !r.cssOk || (r.status !== 200 && r.page !== 'some/missing/page'));
  console.log(JSON.stringify(bad.length ? bad : results.map((r) => r.page + ' ' + r.status), null, 1));
  console.log(results.length + ' pages checked, ' + bad.length + ' with problems');
  fs.writeFileSync(out + '/live-check.json', JSON.stringify(results, null, 1));
})();
