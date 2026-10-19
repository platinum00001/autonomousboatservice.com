// Live end-to-end test: submits a quote (with a photo), a partner application and a data request.
// Rows are named "E2E TEST" so they can be deleted afterward.
const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'https://platinum00001.github.io/autonomousboatservice.com/';
const photo = process.argv[3] || '/tmp/test-boat.jpg';
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(base, { waitUntil: 'networkidle2' });
  // consent required: submitting without it must fail
  await p.type('#q-name', 'E2E TEST boater'); await p.type('#q-phone', '508-555-0142'); await p.type('#q-email', 'e2e@test.invalid');
  await p.type('#q-make', 'Boston Whaler'); await p.type('#q-model', 'Montauk 170'); await p.type('#q-len', '17');
  await p.type('#q-engine', 'Mercury 90 outboard'); await p.type('#q-loc', 'Falmouth Inner Harbor');
  await p.select('#q-service', 'engine_outboard'); await p.select('#q-urg', 'this_week');
  await p.type('#q-details', 'E2E TEST - please delete. Rough idle.');
  await new Promise((r) => setTimeout(r, 3000));
  await p.click('#quote-form button[type=submit]'); await new Promise((r) => setTimeout(r, 800));
  const noConsent = await p.$eval('#quote-form', (f) => !f.hidden);
  const input = await p.$('#q-photos'); await input.uploadFile(photo);
  await p.click('#quote-form input[name=consent_share]');
  await p.click('#quote-form button[type=submit]');
  await p.waitForSelector('#quote-success:not([hidden])', { timeout: 30000 }).catch(() => {});
  const quoteOk = await p.$eval('#quote-success', (e) => !e.hidden);
  const quoteMsg = await p.$eval('#quote-form .form-msg', (e) => e.textContent);
  await p.evaluate(() => document.getElementById('quote-success').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: process.env.SHOT || '/tmp/quote-success.png' });

  await p.goto(base + 'partners.html', { waitUntil: 'networkidle2' });
  await p.type('#p-shop', 'E2E TEST Marine'); await p.type('#p-contact', 'Pat Test'); await p.type('#p-phone', '508-555-0143');
  await p.type('#p-email', 'shop-e2e@test.invalid'); await p.click('input[value=engine_outboard]'); await p.click('input[value=mobile_dockside]');
  await p.type('#p-area', 'Falmouth, Bourne'); await new Promise((r) => setTimeout(r, 3000));
  await p.click('#partner-form button[type=submit]');
  await p.waitForSelector('#partner-success:not([hidden])', { timeout: 20000 }).catch(() => {});
  const partnerOk = await p.$eval('#partner-success', (e) => !e.hidden);

  await p.goto(base + 'privacy.html#data-deletion', { waitUntil: 'networkidle2' });
  await p.type('#d-contact', 'e2e@test.invalid'); await p.type('#d-note', 'E2E TEST'); await new Promise((r) => setTimeout(r, 3000));
  await p.click('#data-form button[type=submit]'); await new Promise((r) => setTimeout(r, 4000));
  const dataMsg = await p.$eval('#data-form .form-msg', (e) => e.textContent);
  console.log(JSON.stringify({ blockedWithoutConsent: noConsent, quoteOk, quoteMsg, partnerOk, dataMsg, errors: errs }, null, 1));
  await b.close();
})();
