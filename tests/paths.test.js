// Run: node tests/paths.test.js
// The site is served from a sub-path (/autonomousboatservice.com/) until DNS is live, so no page may use
// root-absolute links; config.js must never contain a secret key; every local link/asset must exist;
// the call button must be hidden while PHONE is the placeholder; SEO basics must be present.
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const html = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const files = [...html, ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f), 'css/styles.css', 'site.webmanifest', 'config.js'];
let links = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(root, f), 'utf8');
  const bad = s.match(/(?:href|src|action|srcset)=["']\/(?!\/)[^"']*/g) || [];
  assert.deepStrictEqual(bad, [], f + ' has root-absolute paths: ' + bad.join(', '));
  assert.ok(!/location\.origin\s*\+\s*["']\//.test(s), f + ' builds URLs from location.origin');
  assert.ok(!/url\(\s*["']?\/(?!\/)/.test(s), f + ' has a root-absolute CSS url()');
  if (f.endsWith('.html')) {
    for (const m of s.matchAll(/(?:href|src)="([^"#?:]+)(?:[?#][^"]*)?"/g)) {
      if (/^(mailto|tel|https?|data)/.test(m[1]) || /['+(]/.test(m[1])) continue;
      assert.ok(fs.existsSync(path.join(root, m[1])), f + ' links to missing file ' + m[1]);
      links++;
    }
    assert.ok(/<title>[^<]{10,}<\/title>/.test(s) && /name="description" content="[^"]{10,}"/.test(s), f + ' needs title + description');
    assert.ok(/og:image" content="https:\/\/[^"]+\/og\.jpg"/.test(s) && /twitter:card" content="summary_large_image"/.test(s), f + ' missing share tags');
    assert.ok(/privacy\.html/.test(s) && /terms\.html/.test(s), f + ' missing privacy/terms links');
    for (const m of s.matchAll(/<a [^>]*data-call[^>]*>/g)) assert.ok(/\bhidden\b/.test(m[0]), f + ' call button not hidden by default');
  }
}
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ld = [...idx.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const biz = ld.find(x => x['@type'] === 'ProfessionalService');
assert.ok(biz && biz.areaServed.length > 10, 'ProfessionalService JSON-LD with areaServed');
assert.ok(!('address' in biz), 'no fake address in JSON-LD (service-area business)');
assert.ok(!/000-0000|000\) 000/.test(JSON.stringify(ld)), 'placeholder phone must not appear in JSON-LD');
assert.ok(ld.some(x => x['@type'] === 'FAQPage'), 'FAQPage JSON-LD');
for (const n of ['name', 'phone', 'email', 'boat_make', 'boat_model', 'boat_length_ft', 'engine', 'location', 'service', 'urgency', 'photos', 'consent_share', 'website_url'])
  assert.ok(new RegExp('name="' + n + '"').test(idx), 'quote form field ' + n);
assert.ok(/name="consent_share" required/.test(idx), 'consent must be required');
assert.ok(/id="data-deletion"/.test(fs.readFileSync(path.join(root, 'privacy.html'), 'utf8')), 'privacy.html needs #data-deletion');
assert.ok(/referral service/i.test(fs.readFileSync(path.join(root, 'terms.html'), 'utf8')), 'terms needs referral disclaimer');
for (const n of ['shop_name', 'contact_name', 'phone', 'email', 'services', 'service_area']) assert.ok(new RegExp('name="' + n + '"').test(fs.readFileSync(path.join(root, 'partners.html'), 'utf8')), 'partner field ' + n);
for (const f of ['sitemap.xml', 'robots.txt', 'og.jpg', 'favicon.ico']) assert.ok(fs.existsSync(path.join(root, f)), f + ' missing');
const cfg = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const code = cfg.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
assert.ok(!/service_role|sb_secret_/.test(code), 'config.js must not contain a secret key');
assert.ok(/SUPABASE_ANON_KEY:\s*"sb_publishable_/.test(cfg), 'only the publishable key belongs in config.js');
assert.ok(/PHONE:\s*"/.test(cfg), 'PHONE constant missing');
// Every forbidden claim we promised not to make:
const allText = html.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
for (const claim of [/certified tech/i, /licensed and insured/i, /5[- ]star/i, /aggregateRating|\d+(\.\d)?\s*stars?\b|\d+\+?\s*reviews/i, /our technicians/i, /\$\d/]) assert.ok(!claim.test(allText), 'unsupported claim found: ' + claim);
console.log('✓', files.length, 'files sub-path safe;', links, 'local links resolve; SEO, form fields, consent, JSON-LD, no secret key, no fake claims');
