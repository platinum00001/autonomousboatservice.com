# Autonomous Boat Service — autonomousboatservice.com

Lead-generation site for boat repair and service referrals on Cape Cod, Falmouth, the Islands and the South Shore.
Boaters send a quote request; staff review it on the staff page and pass it to a partner repair shop.
**It's a referral service**: the site never claims to employ techs, hold certifications, or have reviews or prices.

- Live (until DNS is fixed): https://platinum00001.github.io/autonomousboatservice.com/
- Future: https://autonomousboatservice.com/ (see docs/SETUP.md, "Custom domain")
- Hosting: GitHub Pages (static, free). Data: Supabase project `james-sites`, schema `boatservice`.

## Edit
| What | Where |
|---|---|
| Phone number (shows the Call buttons when real) | `config.js` → `PHONE`, then `python3 tools/build.py` |
| Copy, services, towns, FAQ | `tools/build.py`, then `python3 tools/build.py` |
| Colors / layout | `css/styles.css` |
| Logo / share image | `tools/make_images.py` |
| Database, RLS, rate limits | `supabase/schema.sql` |
| Form intake + staff API | `supabase/functions/boatservice-api/index.ts` |

## Pages
`index.html` (hero, services, how it works, service area, quote form, FAQ) · `partners.html` (shops apply for leads) ·
`staff.html` (staff login, leads with status/assigned shop, CSV) · `privacy.html` (with `#data-deletion`) · `terms.html` · `404.html`

## Tests
- `node tests/paths.test.js` — sub-path-safe links, SEO tags, JSON-LD (no fake address/phone), form fields, no secret key, no fake claims.
- `tests/rls.test.sql` — run in the Supabase SQL editor; ends with `RLS TEST RESULT: ALL PASS (27 checks)` and rolls everything back.
- `node tools/smoke.js <url> <dir>` — headless check of every page + screenshots (needs puppeteer-core).

Owner steps: see [docs/SETUP.md](docs/SETUP.md).
