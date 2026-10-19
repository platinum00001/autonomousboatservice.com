// Run: node tests/paths.test.js
// The site is served from a sub-path (/autonomousboatservice.com/) until DNS is live, so no page may use
// root-absolute links; config.js must never contain a secret key; every local link/asset must exist
// (resolved relative to each page, including services/, areas/ and guides/); the call button must be
// hidden while PHONE is the placeholder; SEO, JSON-LD, consent and honesty rules must hold.
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => {
  const rel = d ? d + '/' + e.name : e.name;
  if (e.isDirectory()) return ['services', 'areas', 'guides'].includes(rel) ? walk(rel) : [];
  return e.name.endsWith('.html') ? [rel] : [];
});
const html = walk('');
const files = [...html, ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f), 'css/styles.css', 'site.webmanifest', 'config.js'];
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ldOf = (s) => [...s.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
let links = 0;
for (const f of files) {
  const s = read(f);
  const bad = s.match(/(?:href|src|action|srcset)=["']\/(?!\/)[^"']*/g) || [];
  assert.deepStrictEqual(bad, [], f + ' has root-absolute paths: ' + bad.join(', '));
  assert.ok(!/location\.origin\s*\+\s*["']\//.test(s), f + ' builds URLs from location.origin');
  assert.ok(!/url\(\s*["']?\/(?!\/)/.test(s), f + ' has a root-absolute CSS url()');
  if (!f.endsWith('.html')) continue;
  assert.ok(!s.includes('~/'), f + ' still has an unrewritten ~/ link');
  if (f !== '404.html') for (const m of s.matchAll(/(?:href|src)="([^"#?:]*)(?:[?#][^"]*)?"/g)) {
    if (!m[1] || /^(mailto|tel|https?|data)/.test(m[1]) || /['+(]/.test(m[1])) continue;
    let t = path.join(root, path.dirname(f), m[1]);
    if (m[1].endsWith('/') || m[1] === '.' || m[1] === '..') t = path.join(t, 'index.html');
    assert.ok(fs.existsSync(t), f + ' links to missing file ' + m[1]);
    links++;
  }
  assert.ok(/<title>[^<]{10,}<\/title>/.test(s) && /name="description" content="[^"]{10,}"/.test(s), f + ' needs title + description');
  assert.ok(/og:image" content="https:\/\/[^"]+\/og[-\w]*\.jpg"/.test(s) && /twitter:card" content="summary_large_image"/.test(s), f + ' missing share tags');
  const og = s.match(/og:image" content="https:\/\/[^"]+\/(og[-\w]*\.jpg)"/)[1];
  assert.ok(fs.existsSync(path.join(root, og)), f + ' share image missing ' + og);
  assert.ok(/privacy\.html/.test(s) && /terms\.html/.test(s), f + ' missing privacy/terms links');
  assert.ok(/<link rel="canonical" href="https:\/\//.test(s), f + ' canonical');
  for (const m of s.matchAll(/<a [^>]*data-call[^>]*>/g)) assert.ok(/\bhidden\b/.test(m[0]), f + ' call button not hidden by default');
  ldOf(s); // every JSON-LD block must parse
}
// 404 uses absolute links (GitHub Pages serves it at any depth)
assert.ok(!/href="(?!https?:|mailto:|tel:|#)[^"]+"/.test(read('404.html')), '404 must use absolute links');
// home page
const idx = read('index.html'), ld = ldOf(idx);
const biz = ld.find(x => x['@type'] === 'ProfessionalService');
assert.ok(biz && biz.areaServed.length > 10, 'ProfessionalService JSON-LD with areaServed');
assert.ok(!('address' in biz), 'no fake address in JSON-LD (service-area business)');
assert.ok(!/000-0000|000\) 000/.test(JSON.stringify(ld)), 'placeholder phone must not appear in JSON-LD');
assert.ok(ld.some(x => x['@type'] === 'FAQPage'), 'FAQPage JSON-LD');
assert.ok(/id="testimonials"[^>]*hidden|hidden[^>]*id="testimonials"/.test(idx), 'testimonials placeholder must stay hidden');
for (const f of ['index.html', 'quote.html']) {
  const s = read(f);
  for (const n of ['name', 'phone', 'email', 'boat_make', 'boat_model', 'boat_length_ft', 'engine', 'location', 'service', 'urgency', 'photos', 'consent_share', 'website_url'])
    assert.ok(new RegExp('name="' + n + '"').test(s), f + ' quote form field ' + n);
}
// consent wording: anonymous summary first, contact to ONE matched shop only after matching
for (const f of ['index.html', 'quote.html', 'parts.html']) {
  const s = read(f);
  assert.ok(/name="consent_share" required/.test(s), f + ' consent must be required');
  assert.ok(/without my name or contact details/.test(s) && /one matched partner shop only after I.m matched/.test(s), f + ' consent wording');
}
const parts = read('parts.html');
for (const n of ['part_name', 'part_number', 'make', 'model', 'model_year', 'serial', 'photos', 'fulfillment', 'location', 'name', 'phone', 'email', 'website_url']) assert.ok(new RegExp('name="' + n + '"').test(parts), 'parts field ' + n);
// service / area / guide pages carry the right structured data and a quote CTA
const kinds = { services: 'Service', areas: 'Service', guides: 'Article' };
let typed = 0;
for (const f of html.filter(f => /^(services|areas|guides)\/(?!index)/.test(f))) {
  const s = read(f), l = ldOf(s), want = kinds[f.split('/')[0]];
  assert.ok(l.some(x => x['@type'] === want), f + ' needs ' + want + ' JSON-LD');
  assert.ok(l.some(x => x['@type'] === 'BreadcrumbList'), f + ' needs BreadcrumbList');
  if (!/checklist/.test(f)) assert.ok(l.some(x => x['@type'] === 'FAQPage') && /<details><summary>/.test(s), f + ' needs FAQ');
  assert.ok(/quote\.html/.test(s), f + ' needs a quote CTA');
  typed++;
}
assert.ok(typed >= 27, 'expected 10 service + 12 area + 5 guide pages, got ' + typed);
// titles and descriptions are unique
const titles = html.map(f => (read(f).match(/<title>([^<]+)/) || [])[1]);
assert.strictEqual(new Set(titles).size, titles.length, 'page titles must be unique');
// private pages
for (const f of ['staff.html', 'lead.html', 'account.html', '404.html']) assert.ok(/name="robots" content="noindex/.test(read(f)), f + ' must be noindex');
assert.ok(/name="referrer" content="no-referrer"/.test(read('lead.html')), 'lead.html must send no referrer');
const robots = read('robots.txt'), sitemap = read('sitemap.xml');
for (const f of ['staff.html', 'lead.html', 'account.html']) { assert.ok(robots.includes('Disallow: /' + f), 'robots disallows ' + f); assert.ok(!sitemap.includes(f), 'sitemap excludes ' + f); }
assert.ok((sitemap.match(/<url>/g) || []).length >= 35, 'sitemap lists all public pages');
// plans: no invented prices
assert.ok(/Request pricing/.test(read('plans.html')), 'plans must say Request pricing');
// legal + partner page
assert.ok(/id="data-deletion"/.test(read('privacy.html')), 'privacy.html needs #data-deletion');
assert.ok(/one shop only|that one shop only/.test(read('privacy.html')), 'privacy explains one-shop release');
assert.ok(/service-matching company/i.test(read('terms.html')), 'terms needs service-matching disclaimer');
const partners = read('partners.html');
for (const n of ['shop_name', 'contact_name', 'phone', 'email', 'services', 'service_area']) assert.ok(new RegExp('name="' + n + '"').test(partners), 'partner field ' + n);
assert.ok(/value="parts"/.test(partners) && /Release|release/.test(partners) && /14 days/.test(partners), 'partner page explains blind offers + parts');
// staff JS: the old full-details "Copy for shop" is gone; offers + release exist
const staff = read('js/staff.js');
assert.ok(!/Copy for shop/.test(staff) && /create_offers/.test(staff) && /release_offer/.test(staff) && /TODO\(Resend\)/.test(staff), 'staff.js blind-offer flow');
for (const f of ['sitemap.xml', 'robots.txt', 'og.jpg', 'favicon.ico']) assert.ok(fs.existsSync(path.join(root, f)), f + ' missing');
const cfg = read('config.js');
const code = cfg.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
assert.ok(!/service_role|sb_secret_/.test(code), 'config.js must not contain a secret key');
assert.ok(/SUPABASE_ANON_KEY:\s*"sb_publishable_/.test(cfg), 'only the publishable key belongs in config.js');
assert.ok(/PHONE:\s*"/.test(cfg), 'PHONE constant missing');
// Every forbidden claim we promised not to make:
const allText = html.map(read).join('\n');
for (const claim of [/certified tech/i, /licensed and insured/i, /5[- ]star/i, /aggregateRating|\d+(\.\d)?\s*stars?\b|\d+\+?\s*reviews/i, /our technicians/i, /our mechanics/i, /\$\d/, /years in business/i]) assert.ok(!claim.test(allText), 'unsupported claim found: ' + claim);
console.log('✓', html.length, 'pages +', files.length - html.length, 'assets sub-path safe;', links, 'local links resolve;', typed, 'service/area/guide pages with JSON-LD + FAQ; consent, privacy pages, no secret key, no fake claims');
