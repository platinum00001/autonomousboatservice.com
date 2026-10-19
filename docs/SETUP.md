# Autonomous Boat Service — owner setup

Live now: **https://platinum00001.github.io/autonomousboatservice.com/**
Repo: https://github.com/platinum00001/autonomousboatservice.com
Supabase project: `james-sites` (ref `oiousqgzqcjanikglkxl`), schema `boatservice`.

What already works without any of the steps below:
- The quote form, partner application and "delete my data" forms save to Supabase now. They go through the
  edge function `boatservice-api`, which runs every insert as the `anon` role, so RLS still applies.
- Photo uploads go to the private bucket `boatservice-photos`.
- The staff page signs in with email and password and reads leads through the same function, as an admin only.

---

## 1. Become staff (admin SQL), ~2 minutes
No public accounts exist; staff logins are created by you.
1. Supabase → Authentication → Users → **Add user → Create new user**: your email, a password, tick **Auto Confirm User**.
   (Skip this if you already have a login in `james-sites`.)
2. Supabase → SQL editor, run (change the email):
```sql
insert into boatservice.admins (user_id, note)
select id, 'owner' from auth.users where email = 'YOUR-EMAIL@example.com'
on conflict (user_id) do nothing;
```
3. Open `staff.html` and sign in. Remove someone: `delete from boatservice.admins where user_id = (select id from auth.users where email = '...');`

## 2. Redirect URL (for email sign-in links and password resets)
Supabase → Authentication → URL Configuration → **Redirect URLs**, add both (leave the Site URL alone):
- `https://platinum00001.github.io/autonomousboatservice.com/**`
- `https://autonomousboatservice.com/**` (for later)

Password sign-in works without this; magic links and reset emails need it.
Supabase's built-in email is limited to a few messages per hour. For dependable email, connect Resend as custom SMTP
(Authentication → Emails → SMTP), the same way as the other sites.

## 3. (Optional) Expose the schema
Not required: the site uses the edge function. If you want supabase-js to query `boatservice` directly, go to
Project Settings → Data API → **Exposed schemas** and add `boatservice`.
Currently exposed: public, graphql_public, cape_island_recovery, clubs4love. `milestones` and `rtr_app` are still missing, for the other apps.

## 4. Custom domain: autonomousboatservice.com
**Current state (checked Oct 19, 2026):** the domain is registered at HostGator (registrar of record: Launchpad.com Inc.)
until **2027-08-23**, but its nameservers are
`NS1.VERIFICATION-HOLD.SUSPENDED-DOMAIN.COM` / `NS2.VERIFICATION-HOLD.SUSPENDED-DOMAIN.COM` (changed 2026-08-08).
That means the domain is **suspended for an unverified registrant email (ICANN verification hold)**. Public DNS currently
answers `74.119.239.234` (served by the suspension nameservers, i.e. a parking or suspension page). Nothing will point to the site until this is cleared.

Steps, in order:
1. **Clear the hold.** Log in to HostGator → Domains → autonomousboatservice.com. Confirm the registrant contact email
   (resend the verification email and click the link). The nameservers return to HostGator's defaults within a few hours.
2. **DNS records** (HostGator → Domains → DNS / Zone Editor). Delete any other A/AAAA records for `@` and `www`, then add:

| Type  | Host | Value                    | TTL  |
|-------|------|--------------------------|------|
| A     | @    | 185.199.108.153          | 3600 |
| A     | @    | 185.199.109.153          | 3600 |
| A     | @    | 185.199.110.153          | 3600 |
| A     | @    | 185.199.111.153          | 3600 |
| CNAME | www  | platinum00001.github.io. | 3600 |

   Optional IPv6 (AAAA @): 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153.
3. **Turn on the custom domain in GitHub** (only after `dig autonomousboatservice.com +short` shows the 185.199.x IPs):
   repo → Settings → Pages → Custom domain → `autonomousboatservice.com` → Save → tick **Enforce HTTPS** once the certificate is issued.
   This adds a `CNAME` file to the repo. It was left out on purpose: with a custom domain set, the github.io address
   redirects to the domain, which would break the site while the domain is suspended.
4. In `tools/build.py`, set `SITE_URL = "https://autonomousboatservice.com/"`, run `python3 tools/build.py`, then commit and push.
   This updates canonical links, sitemap, robots and share tags.
5. Google Search Console: add the domain property and submit `https://autonomousboatservice.com/sitemap.xml`.

## 5. Phone number with call forwarding
`config.js` → `PHONE` is a placeholder, so all Call buttons are hidden and the quote form is the main call to action.
Pick a number that **forwards to partner shops** (or to you, for triage):
- **Google Voice**: free for a personal account (Voice for Google Workspace starts around $10/user/month). One local
  508 number, forwards to any phone, has voicemail transcription. Simple, but no automatic routing to different shops.
- **Twilio**: a local number costs about **$1.15/month**, plus per-minute charges (roughly $0.0085/min inbound and
  $0.014/min for the forwarded leg). It can route by menu ("press 1 for Upper Cape") or time of day, whisper "boat service
  lead" to the shop, and log every call for referral billing. Business calling, and any texting, needs A2P 10DLC or
  toll-free registration first.

Once you have the number: set `PHONE: "(508) 555-0123"` (your real number) in `config.js`, run `python3 tools/build.py`
(this adds `telephone` to the JSON-LD), then commit and push. The Call buttons appear automatically.

## 6. Google Business Profile (service-area business)
1. https://business.google.com → Add business → "Autonomous Boat Service". Category: **Boat repair shop**, or a
   referral-style category such as "Marine service station" if Google offers it. Pick the one closest to what you do,
   and don't call it a shop you aren't.
2. When asked "Do you want to add a location customers can visit?", answer **No**. Then add service areas: Falmouth,
   Bourne, Mashpee, Sandwich, Barnstable, Yarmouth, Dennis, Chatham, Martha's Vineyard, Nantucket, Plymouth, and so on.
   Your home address stays hidden.
3. Add the phone number from step 5 and the website. Describe it honestly as a referral and matching service.
4. Verify (video or postcard), then add photos and the services list. Only ask real customers for reviews.

## 7. Social handles (nothing was created)
X: `autoboatservice`, `capeboatrepair`, `boatservicecc` are free (checked Oct 19). `AutonomousBoat` is taken.
Facebook and Instagram couldn't be checked automatically. Try `autonomousboatservice` on both.
After you create an account, paste its URL into `config.js` → `SOCIAL`. The footer shows it automatically.

## 8. Google / Facebook login
Not used. There are no public member accounts, and staff use email login. If you ever add public sign-in, the provider
callback URL is `https://oiousqgzqcjanikglkxl.supabase.co/auth/v1/callback`. Privacy has a `#data-deletion` section ready.

## 9. Partner shops
Before you send any leads to a shop, agree referral terms with it in writing. Boaters consent on the form to have their
request shared with partner shops; don't use their details for anything else.
