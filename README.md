# Autonomous Boat Service — autonomousboatservice.com

A service-matching site for boat repair, service and parts on Cape Cod, the Islands and the South Shore.
Boaters send a service or parts request (as a guest, or signed in). Staff send approved partner shops an **anonymous
blind offer**, and then **release the customer's contact to one shop**.
**It's a service-matching company**: the site never claims to employ mechanics, hold certifications, or have reviews, staff, an address, years in business or prices.

- Live (until DNS is fixed): https://platinum00001.github.io/autonomousboatservice.com/
- Future: https://autonomousboatservice.com/ (see docs/SETUP.md, "Custom domain")
- Hosting: GitHub Pages (static, free). Data: Supabase project `james-sites`, schema `boatservice`, edge function `boatservice-api` (v2).

## Edit
| What | Where |
|---|---|
| Phone number (shows the Call buttons when real) | `config.js` → `PHONE`, then `python3 tools/build.py` |
| Service pages copy (SEO title, FAQ…) | `tools/content_services.py` |
| Town pages | `tools/content_areas.py` |
| Guides + seasonal checklist | `tools/content_guides.py` |
| Layout, nav, plans, home, legal pages | `tools/build.py` |
| Colors / layout | `css/styles.css` |
| Logo / share images (og-*.jpg) | `tools/make_images.py` |
| Database, RLS, offers, rate limits | `supabase/schema.sql` (migrations `migration_v2*.sql`) |
| Form intake, offers, staff API | `supabase/functions/boatservice-api/index.ts` |

Run `python3 tools/build.py` after any edit. Pages are written with `~/` links, which become `./` or `../` per folder depth.

## Pages (42)
Home · `quote.html` · `parts.html` (parts finder) · `plans.html` (maintenance plans, "Request pricing") · `about.html` (why us, how it works) ·
`services/` (index + 10 service pages) · `areas/` (index + 12 town and island pages) · `guides/` (index + 4 guides + seasonal checklist) ·
`partners.html` (for shops: blind-offer flow, territories, application) · `account.html` (optional customer sign-in, noindex) ·
`lead.html` (shop offer page, `#t=TOKEN`, noindex, no-referrer) · `staff.html` (Leads / Parts / Partner shops / Privacy tabs) · `privacy.html` · `terms.html` · `404.html`

## Blind-lead flow
1. A boater submits a quote or parts request and agrees to the two-step sharing consent.
2. Staff open the request, pick approved shops, check the town and notes (phones and emails are auto-scrubbed), and click **Create offer links**.
   Each shop gets a random 48-hex token. Only its sha256 hash is stored. Links expire after 14 days.
3. Staff copy the link or click **Email shop** (mailto with no customer data). *TODO(Resend): send automatically.*
4. The shop opens `lead.html#t=…`, sees the anonymous summary and photos (signed URLs, valid for an hour), and taps **Interested** or **Pass** with an optional note and range.
5. Staff click **Release contact to [shop]**. The lead is marked assigned, the other offers are withdrawn, and only that shop's link now shows the name, phone, email and location.

## Tests
- `node tests/paths.test.js` — every page (including subfolders): sub-path-safe links that resolve, SEO and share tags, JSON-LD (Service/Article/FAQ/Breadcrumb; no fake address or phone), consent wording, noindex on private pages, no secret key, no fake claims.
- `tests/rls.test.sql` — run in the Supabase SQL editor. It ends with `RLS TEST RESULT: ALL PASS (54 checks)` and rolls everything back. Covers quotes, parts, customer `my_requests`, blind offers, token hashing, release, withdraw and expiry.
- `node tools/smoke.js <url> <dir>` — headless check of all 42 pages (JS errors, failed requests, horizontal overflow, hidden call buttons) plus screenshots.
- `node tools/form-test.js <url> <photo>` — live end-to-end form submit (rows are named "E2E TEST"; delete them afterward).

Owner steps: see [docs/SETUP.md](docs/SETUP.md).
