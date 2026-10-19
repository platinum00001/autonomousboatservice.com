#!/usr/bin/env python3
"""Builds every HTML page, sitemap.xml, robots.txt and site.webmanifest.
Run from anywhere:  python3 tools/build.py
Edit copy here; phone/email/social live in config.js.
When autonomousboatservice.com points at GitHub Pages, change SITE_URL below, rebuild, and push."""
import json, re, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = "https://platinum00001.github.io/autonomousboatservice.com/"   # -> "https://autonomousboatservice.com/" after DNS
NAME = "Autonomous Boat Service"
TODAY = datetime.date.today().isoformat()

cfg = open(os.path.join(ROOT, "config.js")).read()
PHONE = re.search(r'PHONE:\s*"([^"]*)"', cfg).group(1)
digits = re.sub(r"\D", "", PHONE)
PHONE_REAL = not re.search(r"coming soon|placeholder", PHONE, re.I) and len(digits) >= 10 and set(digits) != {"0"}
TEL = ("+1" + digits if len(digits) == 10 else "+" + digits) if PHONE_REAL else ""

ICON = {
 "engine": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="12" height="9" rx="2"/><path d="M15 10h3l2 2v2l-2 2h-3M7 7V4h4v3M7 16v4M11 16v4"/></svg>',
 "snow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/></svg>',
 "hull": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14h20l-3 5H5zM6 14V9h8l3 5M9 9V6"/></svg>',
 "bolt": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
 "paint": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="6" rx="1"/><path d="M17 6h3v5h-8v3M10 14h4v7h-4z"/></svg>',
 "van": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
 "sos": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/></svg>',
 "wrap": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c3-6 15-6 18 0M3 15h18l-2 4H5z"/><path d="M8 11V8M12 10V6M16 11V8"/></svg>',
}
SERVICES = [
 ("engine_outboard", "engine", "Outboard engine repair", "Won't start, rough idle, overheating, lower-unit and gearcase work, tune-ups and annual service."),
 ("engine_inboard", "engine", "Inboard & sterndrive repair", "Diagnostics, cooling systems, outdrives, impellers, alignment and diesel or gas inboard service."),
 ("winterizing", "snow", "Winterizing & shrink-wrap", "Fall layup, fogging and antifreeze, spring commissioning, plus shrink-wrap and storage referrals."),
 ("hull_fiberglass", "hull", "Hull & fiberglass", "Gelcoat and fiberglass repair, dings and cracks, transom and stringer work, detailing."),
 ("electrical", "bolt", "Electrical & electronics", "Batteries, charging, wiring faults, lighting, plus chartplotter, VHF, sonar and autopilot installs."),
 ("bottom_paint", "paint", "Bottom paint", "Haul-out, pressure wash, sanding and antifouling bottom paint before launch."),
 ("mobile_dockside", "van", "Mobile & dockside service", "Shops that come to your slip, mooring or driveway, so your boat doesn't have to move."),
 ("emergency_towing", "sos", "Emergency & towing referral", "Broken down? We help you find who can respond. If anyone is in danger, call 911 or the Coast Guard on VHF 16 first."),
]
SERVICE_LABEL = {"engine_outboard": "Outboard engine repair", "engine_inboard": "Inboard / sterndrive repair", "winterizing": "Winterizing", "shrink_wrap": "Shrink-wrap & storage",
  "hull_fiberglass": "Hull & fiberglass", "electrical": "Electrical & electronics", "bottom_paint": "Bottom paint", "mobile_dockside": "Mobile / dockside service",
  "emergency_towing": "Emergency / towing referral", "other": "Something else"}
AREAS = [
 ("Upper Cape", ["Falmouth", "Woods Hole", "East Falmouth", "Waquoit", "North Falmouth", "Bourne", "Pocasset", "Buzzards Bay", "Mashpee", "Sandwich"]),
 ("Mid & Lower Cape", ["Hyannis", "Osterville", "Cotuit", "Barnstable", "Yarmouth", "Dennis", "Harwich", "Chatham", "Orleans", "Wellfleet", "Provincetown"]),
 ("The Islands", ["Martha's Vineyard", "Vineyard Haven", "Oak Bluffs", "Edgartown", "Nantucket"]),
 ("South Shore & Buzzards Bay", ["Plymouth", "Duxbury", "Kingston", "Marshfield", "Scituate", "Hingham", "Wareham", "Marion", "Mattapoisett"]),
]
FAQ = [
 ("Are you a boat repair shop?", "No. Autonomous Boat Service is a referral service. We take your request and connect you with independent local marine repair shops that do that kind of work in your area. The shop you choose does the work and gives you its own quote."),
 ("What does it cost?", "Sending a request is free and there's no obligation. You pay the shop directly for any work you approve. Partner shops may pay us a referral fee; that never adds anything to your bill from us."),
 ("Why \"autonomous\"?", "It's about boat service that runs itself for you: one short form, and your request gets routed to a shop that fits your boat, your location and your timing. Robots don't work on your boat. Real, local marine techs do."),
 ("How fast will I hear back?", "We review requests as they come in and try to match you quickly. Timing depends on the season, the job and which shops have openings. Spring launch and fall haul-out are the busiest times, so earlier is better."),
 ("What if it's an emergency on the water?", "If anyone is in danger, call 911 or hail the Coast Guard on VHF channel 16 right away. If you have a towing membership, call it directly. For repairs after you're safe, choose \"Emergency\" on the form and we'll prioritize it."),
 ("Who are the partner shops?", "Independent marine businesses on Cape Cod, the Islands and the South Shore that apply to receive requests. We don't employ the techs or guarantee their work, so ask any shop about its experience, insurance and warranty before you hire it."),
 ("Can someone come to my slip or mooring?", "Often, yes. Choose \"Mobile / dockside service\" or mention it in your request. Many local shops do dockside and driveway work."),
 ("What happens to my information?", "We share your request only with the partner shop or shops we match you with, and only because you agreed to it on the form. We never sell your information. You can ask us to delete it at any time."),
]

def head(title, desc, path, extra=""):
    url = SITE_URL + path
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#0b2638">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE_URL}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{NAME}: boat repair, matched fast on Cape Cod">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{SITE_URL}og.jpg">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="stylesheet" href="css/styles.css">
{extra}</head>
'''

CALL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>'

def header(cur=""):
    home = "index.html"
    def a(href, label, key, cls=""):
        return f'<a href="{href}" class="{cls}"{" aria-current=page" if key == cur else ""}>{label}</a>'
    return f'''<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap navbar">
  <a class="brand" href="{home}"><img src="img/logo.svg" alt="" width="40" height="40"><span><small>Autonomous</small><b>Boat Service</b></span></a>
  <nav class="navlinks" aria-label="Main">
    {a(home + "#services", "Services", "services", "hide-sm")}
    {a(home + "#area", "Service area", "area", "hide-sm")}
    {a(home + "#how", "How it works", "how", "hide-sm")}
    {a(home + "#faq", "FAQ", "faq", "hide-sm")}
    {a("partners.html", "For shops", "partners", "hide-sm")}
    <a class="btn sm sea" data-call hidden href="#">{CALL_ICON}<span>Call</span></a>
    <a class="btn sm" href="{home}#quote">Get a quote</a>
  </nav>
</div></header>
<main id="main">
'''

def footer():
    return f'''</main>
<footer class="site"><div class="wrap">
  <div class="cols">
    <div>
      <a class="brand" href="index.html" style="color:#fff"><img src="img/logo.svg" alt="" width="40" height="40"><span><small style="color:#7fd3dc">Autonomous</small><b style="color:#fff">Boat Service</b></span></a>
      <p style="margin-top:12px">Smart, fast boat service matching for Cape Cod, the Islands and the South Shore. One request connects you with independent local repair shops.</p>
      <p data-call hidden><a data-call hidden href="#"><span data-phone-text></span></a></p>
      <p data-email hidden><a href="#"></a></p>
    </div>
    <div><h3>Boaters</h3><ul>
      <li><a href="index.html#quote">Get a quote</a></li>
      <li><a href="index.html#services">Services</a></li>
      <li><a href="index.html#area">Service area</a></li>
      <li><a href="index.html#faq">FAQ</a></li>
    </ul></div>
    <div><h3>Shops &amp; legal</h3><ul>
      <li><a href="partners.html">Repair shops: get leads</a></li>
      <li><a href="privacy.html">Privacy</a></li>
      <li><a href="privacy.html#data-deletion">Delete my data</a></li>
      <li><a href="terms.html">Terms</a></li>
      <li><a href="staff.html">Staff login</a></li>
    </ul><div id="social"></div></div>
  </div>
  <p class="fine">{NAME} is a referral service. We don't perform repairs; all work is done by independent marine businesses, which set their own prices and warranties. In an emergency on the water, call 911 or the U.S. Coast Guard on VHF channel 16. &copy; <span data-year>2026</span> {NAME}.</p>
</div></footer>
<script src="config.js"></script>
<script src="js/app.js"></script>
'''

def service_options(selected=""):
    opts = ['<option value="">Choose a service…</option>']
    for k, v in SERVICE_LABEL.items():
        opts.append(f'<option value="{k}"{" selected" if k == selected else ""}>{v}</option>')
    return "".join(opts)

def jsonld():
    biz = {
      "@context": "https://schema.org", "@type": "ProfessionalService", "@id": SITE_URL + "#business",
      "name": NAME, "url": SITE_URL, "logo": SITE_URL + "img/icon-512.png", "image": SITE_URL + "og.jpg",
      "description": "Boat repair and service referral for Cape Cod, the Islands and the South Shore. One request connects boaters with independent local marine repair shops.",
      "slogan": "Boat repair, matched fast.",
      "areaServed": [{"@type": "City", "name": t + ", MA"} for t in ["Falmouth", "Bourne", "Mashpee", "Sandwich", "Barnstable", "Yarmouth", "Dennis", "Harwich", "Chatham", "Orleans", "Provincetown", "Edgartown", "Oak Bluffs", "Tisbury", "Nantucket", "Plymouth", "Duxbury", "Marshfield", "Scituate", "Hingham", "Wareham", "Marion", "Mattapoisett"]]
                   + [{"@type": "AdministrativeArea", "name": n} for n in ["Cape Cod", "Martha's Vineyard", "South Shore, Massachusetts"]],
      "knowsAbout": [s[2] for s in SERVICES],
      "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Boat service referrals",
         "itemListElement": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": s[2], "description": s[3]}} for s in SERVICES]},
    }
    if PHONE_REAL: biz["telephone"] = TEL
    faq = {"@context": "https://schema.org", "@type": "FAQPage",
           "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}
    site = {"@context": "https://schema.org", "@type": "WebSite", "name": NAME, "url": SITE_URL}
    return "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in (biz, faq, site))

def esc(s): return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")

# ------------------------------------------------------------------ index
cards = "".join(f'''<div class="card"><div class="icon">{ICON[ic]}</div><h3>{t}</h3><p>{d}</p>
<p style="margin-top:10px"><a href="#quote" data-pick-service="{k}">Request this →</a></p></div>''' for k, ic, t, d in SERVICES)
areas = "".join(f'<div class="region"><h3>{r}</h3><ul class="chips">' + "".join(f"<li>{esc(t)}</li>" for t in towns) + "</ul></div>" for r, towns in AREAS)
faqs = "".join(f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in FAQ)
WAVES = '<svg class="waves" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path fill="#0e7d8c" opacity=".55" d="M0 40c120 25 240 25 360 0s240-25 360 0 240 25 360 0 240-25 360 0v50H0z"/><path fill="#f7f3ea" d="M0 62c120 18 240 18 360 0s240-18 360 0 240 18 360 0 240-18 360 0v28H0z"/></svg>'

index = head(f"Boat Repair & Service on Cape Cod | Falmouth, the Islands & South Shore | {NAME}",
  "Need boat repair on Cape Cod? One quick request connects you with local shops for outboard and inboard repair, winterizing, shrink-wrap, fiberglass, electrical, bottom paint and dockside service. Falmouth, the Islands and the South Shore.",
  "", jsonld()) + header() + f'''
<section class="hero">
  <div class="wrap">
    <div>
      <p class="eyebrow">Cape Cod · Falmouth · The Islands · South Shore</p>
      <h1>Boat repair, matched fast.</h1>
      <p class="lead">Tell us what your boat needs once. We connect you with an independent local repair shop that does that kind of work in your area.</p>
      <div class="ctas">
        <a class="btn" href="#quote">Get a quote</a>
        <a class="btn light" data-call hidden href="#">{CALL_ICON}<span>Call <span data-phone-text></span></span></a>
        <a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.35)" href="#how">How it works</a>
      </div>
      <p class="note">Free to request, no obligation. We're a referral service: local shops do the work and quote you directly.</p>
    </div>
    <aside class="hero-card" aria-label="In short">
      <h2>One request. The right shop.</h2>
      <ol>
        <li>Two-minute form: your boat, the problem, where it's kept.</li>
        <li>We match you with a local shop that fits the job.</li>
        <li>The shop contacts you with timing and a quote. You decide.</li>
      </ol>
    </aside>
  </div>
  {WAVES}
</section>
<div class="strip"><div class="wrap"><ul>
  <li>Free for boaters</li><li>Outboards, inboards &amp; sterndrives</li><li>Dockside &amp; mooring service</li><li>Cape, Islands &amp; South Shore</li>
</ul></div></div>

<section class="block" id="services"><div class="wrap">
  <p class="eyebrow">Services</p>
  <h2>What do you need done?</h2>
  <p class="lead">We route requests for all of the common jobs. Pick one to start your quote, or choose "Something else" on the form.</p>
  <div class="grid cards" style="margin-top:24px">{cards}</div>
</div></section>

<section class="block alt" id="how"><div class="wrap">
  <p class="eyebrow">How it works</p>
  <h2>Smart matching, real local techs</h2>
  <p class="lead">"Autonomous" means boat service that runs itself for you. Your request is routed to the right shop, so you don't have to call around the harbor.</p>
  <div class="grid steps" style="margin-top:24px">
    <div class="card"><h3>Tell us about the job</h3><p>Boat make, model and length, the engine, what's wrong, where the boat is and how soon you need it. Add photos if you have them.</p></div>
    <div class="card"><h3>We match a shop</h3><p>We look at the service you need, your town or marina, and your timing, then pass your request to a partner shop that fits.</p></div>
    <div class="card"><h3>The shop quotes you</h3><p>The shop contacts you directly to confirm details, timing and price. You decide whether to go ahead and pay the shop directly.</p></div>
  </div>
</div></section>

<section class="block" id="area"><div class="wrap area">
  <div>
    <p class="eyebrow">Service area</p>
    <h2>Cape Cod, the Islands &amp; the South Shore</h2>
    <p class="lead">Based around Falmouth and the Upper Cape, we route requests across the Cape, Martha's Vineyard, Nantucket and the South Shore, from Hingham to Buzzards Bay.</p>
    <p>Kept somewhere else? Send your request anyway. If we can't match you, we'll tell you.</p>
    <p><a class="btn" href="#quote">Get a quote</a></p>
  </div>
  <div>{areas}</div>
</div></section>

<section class="block alt" id="quote"><div class="wrap quote-wrap">
  <div>
    <p class="eyebrow">Get a quote</p>
    <h2>Tell us what your boat needs</h2>
    <p class="lead">Takes about two minutes. A local shop will contact you with timing and a price.</p>
    <ul class="hint" style="padding-left:1.1rem">
      <li>Free, no obligation.</li>
      <li>We share your request only with matched partner shops.</li>
      <li>Photos help shops quote faster (optional).</li>
    </ul>
    <p class="hint"><strong>On the water and in danger?</strong> Call 911 or the Coast Guard on VHF 16 first.</p>
    <p data-call hidden>Prefer to talk? <a data-call hidden href="#"><span data-phone-text></span></a></p>
  </div>
  <div>
  <form class="panel" id="quote-form" novalidate>
    <fieldset><legend>You</legend>
      <div class="field"><label for="q-name">Name</label><input id="q-name" name="name" type="text" required maxlength="120" autocomplete="name"></div>
      <div class="two">
        <div class="field"><label for="q-phone">Phone</label><input id="q-phone" name="phone" type="tel" required maxlength="30" autocomplete="tel" placeholder="508-555-0123"></div>
        <div class="field"><label for="q-email">Email <span class="opt">(optional)</span></label><input id="q-email" name="email" type="email" maxlength="200" autocomplete="email"></div>
      </div>
    </fieldset>
    <fieldset><legend>Your boat</legend>
      <div class="three">
        <div class="field"><label for="q-make">Make</label><input id="q-make" name="boat_make" type="text" maxlength="80" placeholder="e.g. Boston Whaler"></div>
        <div class="field"><label for="q-model">Model</label><input id="q-model" name="boat_model" type="text" maxlength="80" placeholder="e.g. Montauk 170"></div>
        <div class="field"><label for="q-len">Length (ft)</label><input id="q-len" name="boat_length_ft" type="number" min="5" max="300" step="0.5" inputmode="decimal"></div>
      </div>
      <div class="field"><label for="q-engine">Engine</label><input id="q-engine" name="engine" type="text" maxlength="160" placeholder="e.g. Yamaha F90 outboard, 2016 / twin Mercruiser 5.0"></div>
      <div class="field"><label for="q-loc">Location or marina</label><input id="q-loc" name="location" type="text" required maxlength="160" placeholder="e.g. Falmouth Inner Harbor, mooring / trailer in Mashpee"></div>
    </fieldset>
    <fieldset><legend>The job</legend>
      <div class="two">
        <div class="field"><label for="q-service">Service needed</label><select id="q-service" name="service" required>{service_options()}</select></div>
        <div class="field"><label for="q-urg">How soon?</label><select id="q-urg" name="urgency" required>
          <option value="emergency">Emergency (broken down / taking on water)</option>
          <option value="this_week">This week</option>
          <option value="this_month">This month</option>
          <option value="flexible" selected>Flexible / planning ahead</option></select></div>
      </div>
      <div class="field"><label for="q-details">What's going on? <span class="opt">(optional)</span></label><textarea id="q-details" name="details" maxlength="3000" placeholder="Symptoms, when it started, anything you've tried, best times to reach you"></textarea></div>
      <div class="field"><label for="q-photos">Photos <span class="opt">(optional, up to 6)</span></label><input id="q-photos" name="photos" type="file" accept="image/*" multiple></div>
    </fieldset>
    <div class="hp" aria-hidden="true"><label for="q-web">Website</label><input id="q-web" name="website_url" type="text" tabindex="-1" autocomplete="off"></div>
    <label class="check consent"><input type="checkbox" name="consent_share" required> <span>I agree that {NAME} may share my request and contact details with partner repair shops so they can contact me about this job. (Required. See our <a href="privacy.html">privacy policy</a>.)</span></label>
    <button class="btn" type="submit" style="width:100%">Send my request</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <div class="success" id="quote-success" hidden>
    <h3>Request received. Thank you!</h3>
    <p>We're matching you with a local shop now. The shop will contact you at the phone number you gave to confirm details, timing and a quote.</p>
    <p data-urgent hidden><strong>Marked as an emergency.</strong> If anyone is in danger, call 911 or the Coast Guard on VHF 16. If you have a towing membership, call it directly.</p>
  </div>
  </div>
</div></section>

<section class="block faq" id="faq"><div class="wrap narrow">
  <p class="eyebrow">FAQ</p>
  <h2>Questions boaters ask</h2>
  {faqs}
</div></section>

<section class="cta-band"><div class="wrap">
  <h2>Run a marine repair shop?</h2>
  <p style="margin:0">Get matched with boaters who need your services.</p>
  <a class="btn light" href="partners.html">Apply to receive leads</a>
</div></section>
''' + footer() + '<script src="js/forms.js"></script>\n</body>\n</html>\n'

# ------------------------------------------------------------------ partners
checks = "".join(f'<label class="check"><input type="checkbox" name="services" value="{k}"> <span>{v}</span></label>' for k, v in SERVICE_LABEL.items() if k != "other")
partners = head(f"Marine Repair Shops: Get Boat Service Leads on Cape Cod | {NAME}",
  "Marine repair shops on Cape Cod, the Islands and the South Shore: apply to receive boat service requests from local boaters in your area.",
  "partners.html") + header("partners") + f'''
<section class="page-head"><div class="wrap">
  <p class="eyebrow" style="color:#7fd3dc">For repair shops</p>
  <h1>Get matched with boaters who need you</h1>
  <p class="lead">We collect service requests from boaters across Cape Cod, the Islands and the South Shore, and pass each one to a partner shop that does that work in that area.</p>
</div></section>
<section class="block"><div class="wrap quote-wrap">
  <div>
    <h2>How partnering works</h2>
    <ul>
      <li><strong>You choose your work.</strong> Tell us your services and the towns or harbors you cover. We only send matching requests.</li>
      <li><strong>Requests come with details.</strong> Boat, engine, location, urgency, notes and photos when the boater adds them.</li>
      <li><strong>You quote and do the work directly.</strong> Your prices, your schedule, your customer relationship.</li>
      <li><strong>Boaters agree first.</strong> Every request includes the boater's consent to share their details with partner shops.</li>
    </ul>
    <p>Referral terms are agreed with each shop before any leads are sent. Applying is free and doesn't commit you to anything.</p>
    <p class="hint">Applying doesn't make you a listed or endorsed shop. We'll contact you to talk it through.</p>
  </div>
  <div>
  <form class="panel" id="partner-form" novalidate>
    <div class="field"><label for="p-shop">Shop name</label><input id="p-shop" name="shop_name" type="text" required maxlength="160" autocomplete="organization"></div>
    <div class="two">
      <div class="field"><label for="p-contact">Contact name</label><input id="p-contact" name="contact_name" type="text" required maxlength="120" autocomplete="name"></div>
      <div class="field"><label for="p-phone">Phone</label><input id="p-phone" name="phone" type="tel" required maxlength="30" autocomplete="tel"></div>
    </div>
    <div class="two">
      <div class="field"><label for="p-email">Email</label><input id="p-email" name="email" type="email" required maxlength="200" autocomplete="email"></div>
      <div class="field"><label for="p-web">Website <span class="opt">(optional)</span></label><input id="p-web" name="website" type="url" maxlength="300" placeholder="https://"></div>
    </div>
    <p class="label">Services you offer</p>
    <div class="checks">{checks}</div>
    <div class="field"><label for="p-area">Service area</label><input id="p-area" name="service_area" type="text" required maxlength="300" placeholder="e.g. Falmouth, Bourne, Mashpee; mobile to the Upper Cape"></div>
    <div class="field"><label for="p-notes">Anything else? <span class="opt">(optional)</span></label><textarea id="p-notes" name="notes" maxlength="2000" placeholder="Engine brands you service, capacity, seasonal hours"></textarea></div>
    <div class="hp" aria-hidden="true"><label for="p-hp">Website URL</label><input id="p-hp" name="website_url" type="text" tabindex="-1" autocomplete="off"></div>
    <button class="btn" type="submit" style="width:100%">Apply to receive leads</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <div class="success" id="partner-success" hidden><h3>Thanks, application received.</h3><p>We'll reach out to talk about your services, area and referral terms.</p></div>
  </div>
</div></section>
''' + footer() + '<script src="js/forms.js"></script>\n</body>\n</html>\n'

# ------------------------------------------------------------------ staff
staff = head(f"Staff | {NAME}", "Staff sign-in.", "staff.html", '<meta name="robots" content="noindex,nofollow">\n') + header() + '''
<section class="block"><div class="wrap">
  <div id="auth" class="auth-box" hidden>
    <h1>Staff sign-in</h1>
    <p class="hint">For Autonomous Boat Service staff only. There are no public accounts.</p>
    <form id="pw-form" class="panel">
      <div class="field"><label for="email">Email</label><input id="email" type="email" required autocomplete="username"></div>
      <div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password"></div>
      <button class="btn sea" type="submit">Sign in</button>
      <p style="margin-top:12px"><button type="button" class="linklike" id="link-btn">Email me a sign-in link</button> · <button type="button" class="linklike" id="reset-btn">Forgot password</button></p>
      <p class="form-msg" id="auth-msg" role="status" aria-live="polite"></p>
    </form>
  </div>
  <form id="newpw-form" class="panel auth-box" hidden>
    <h2>Set a new password</h2>
    <div class="field"><label for="newpw">New password</label><input id="newpw" type="password" minlength="8" required autocomplete="new-password"></div>
    <button class="btn sea" type="submit">Save password</button>
    <p class="form-msg" id="newpw-msg"></p>
  </form>
  <div id="dash" hidden>
    <div class="toolbar" style="justify-content:space-between"><h1 style="margin:0">Leads</h1><span class="hint">Signed in as <span id="who"></span> · <button class="linklike" id="signout">Sign out</button></span></div>
    <div id="not-admin" class="success" hidden><h3>Not a staff account yet</h3><p>You're signed in, but this login hasn't been given staff access. The owner can add it with the admin SQL in docs/SETUP.md.</p></div>
    <div id="admin-area" hidden>
      <div class="stats" id="stats"></div>
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected="true" data-for="leads">Leads</button>
        <button role="tab" aria-selected="false" data-for="partners">Partner shops</button>
        <button role="tab" aria-selected="false" data-for="datareq">Privacy requests</button>
      </div>
      <div data-tab="leads">
        <div class="toolbar">
          <label for="f-status" class="label">Show</label>
          <select id="f-status"><option value="">All leads</option><option value="new">New</option><option value="sent_to_shop">Sent to shop</option><option value="closed">Closed</option></select>
          <button class="btn sm ghost" id="reload">Refresh</button>
          <button class="btn sm ghost" id="csv-leads">Export CSV</button>
        </div>
        <div id="leads"></div>
      </div>
      <div data-tab="partners" hidden>
        <div class="toolbar"><button class="btn sm ghost" id="csv-partners">Export CSV</button></div>
        <div id="partners"></div>
      </div>
      <div data-tab="datareq" hidden><div id="datareq" style="margin-top:12px"></div></div>
    </div>
  </div>
</div></section>
''' + footer() + '<script src="js/staff.js"></script>\n</body>\n</html>\n'

# ------------------------------------------------------------------ privacy / terms
privacy = head(f"Privacy Policy | {NAME}", f"How {NAME} collects, shares and deletes information from boat service requests.", "privacy.html") + header() + f'''
<section class="page-head"><div class="wrap"><h1>Privacy policy</h1><p class="lead">Last updated {datetime.date.today().strftime("%B %-d, %Y")}</p></div></section>
<section class="block"><div class="wrap narrow prose">
<p>{NAME} ("we") runs this website to connect boaters with independent marine repair shops. This policy explains what we collect and what we do with it.</p>
<h2>What we collect</h2>
<ul>
  <li><strong>Quote requests:</strong> your name, phone, optional email, boat make, model and length, engine, location or marina, the service you need, how urgent it is, your notes and any photos you upload.</li>
  <li><strong>Partner shop applications:</strong> shop name, contact name, phone, email, website, services and service area.</li>
  <li><strong>Basic technical data:</strong> to stop spam, we keep a one-way, salted fingerprint of your IP address that changes daily. We don't use advertising trackers or sell data.</li>
  <li><strong>Staff logins:</strong> staff sign in with an email address. There are no public accounts.</li>
</ul>
<h2>How we use and share it</h2>
<ul>
  <li>We use your request to find a suitable repair shop, and we share it with the partner shop or shops we match you with. You agree to this when you tick the consent box. Those shops may contact you about your job.</li>
  <li>We don't sell your information or share it for marketing by others.</li>
  <li>Our service providers store data for us: Supabase (database and photo storage) and GitHub Pages (website hosting).</li>
</ul>
<h2>How long we keep it</h2>
<p>We keep requests for as long as needed to arrange the work and handle follow-up, generally up to 24 months, then delete them. You can ask us to delete your information sooner.</p>
<h2 id="data-deletion">Delete my data</h2>
<p>To have your request and photos deleted, send the phone number or email you used below. We'll delete what we hold and confirm using that contact. Shops you were already matched with keep their own records under their own policies, and we'll pass your request on to them when we can.</p>
<form class="panel" id="data-form" novalidate style="max-width:520px">
  <div class="field"><label for="d-contact">Phone or email you used</label><input id="d-contact" name="contact" type="text" required minlength="5" maxlength="200"></div>
  <div class="field"><label for="d-note">Anything else? <span class="opt">(optional)</span></label><input id="d-note" name="note" type="text" maxlength="1000"></div>
  <div class="hp" aria-hidden="true"><label for="d-hp">Website</label><input id="d-hp" name="website_url" type="text" tabindex="-1" autocomplete="off"></div>
  <button class="btn sea" type="submit">Request deletion</button>
  <p class="form-msg" role="status" aria-live="polite"></p>
</form>
<p data-email hidden>You can also email us: <a href="#"></a></p>
<h2>Children</h2>
<p>This site is for adults. We don't knowingly collect information from children under 13.</p>
<h2>Changes</h2>
<p>We'll post any changes on this page with a new date.</p>
</div></section>
''' + footer() + '<script src="js/forms.js"></script>\n</body>\n</html>\n'

terms = head(f"Terms of Use | {NAME}", f"Terms for using {NAME}, a boat repair referral service.", "terms.html") + header() + f'''
<section class="page-head"><div class="wrap"><h1>Terms of use</h1><p class="lead">Last updated {datetime.date.today().strftime("%B %-d, %Y")}</p></div></section>
<section class="block"><div class="wrap narrow prose">
<h2>We're a referral service</h2>
<p>{NAME} connects boat owners with independent marine repair and service businesses ("partner shops"). <strong>We don't perform repairs, employ technicians, or supervise any work.</strong> Partner shops are independent businesses, not our employees or agents.</p>
<h2>No guarantee</h2>
<ul>
  <li>We don't guarantee that we can match every request, that a shop will be available, or how soon a shop will respond.</li>
  <li>We don't guarantee, warrant or endorse any shop's work, prices, licensing, insurance or timing. Check those directly with the shop before you hire it.</li>
  <li>Any quote, agreement, payment, warranty or dispute about work is between you and the shop.</li>
</ul>
<h2>Fees</h2>
<p>Sending a request is free for boaters. Partner shops may pay us a referral fee. We don't add charges to any shop's bill.</p>
<h2>Emergencies</h2>
<p>This website isn't an emergency service. If anyone is in danger on the water, call 911 or the U.S. Coast Guard on VHF channel 16. Submitting a form doesn't mean help is on the way.</p>
<h2>Your information</h2>
<p>Give accurate information and only submit requests for boats you own or are authorized to arrange service for. By submitting a request, you agree that we may share it with partner shops as described in our <a href="privacy.html">privacy policy</a>.</p>
<h2>Liability</h2>
<p>To the fullest extent allowed by law, {NAME} isn't liable for any loss, damage or injury arising from work performed by a partner shop, or from delays or failures to match a request. The site is provided "as is".</p>
<h2>Partner shops</h2>
<p>Applying to receive leads creates no obligation for either side. Referral terms are agreed separately in writing before any leads are sent.</p>
<h2>Governing law</h2>
<p>These terms are governed by the laws of the Commonwealth of Massachusetts.</p>
</div></section>
''' + footer() + '</body>\n</html>\n'

# ------------------------------------------------------------------ 404 (served for any missing path, so set a base first)
nf_head = head(f"Page not found | {NAME}", "Page not found.", "404.html",
  '<meta name="robots" content="noindex">\n').replace('<meta charset="utf-8">',
  '<meta charset="utf-8">\n<script>(function(){var p=location.pathname,m="/autonomousboatservice.com/";document.write(\'<base href="\'+(p.indexOf(m)===0?m:"/")+\'">\');})();</script>')
notfound = nf_head + header() + '''
<section class="block"><div class="wrap narrow" style="text-align:center;padding:40px 20px">
  <p class="eyebrow">404</p>
  <h1>This page drifted off its mooring</h1>
  <p class="lead" style="margin:0 auto 20px">The page you're looking for isn't here. Need boat service? Start a request.</p>
  <p><a class="btn" href="index.html#quote">Get a quote</a> <a class="btn ghost" href="index.html">Home</a></p>
</div></section>
''' + footer() + '</body>\n</html>\n'

for name, html in [("index.html", index), ("partners.html", partners), ("staff.html", staff), ("privacy.html", privacy), ("terms.html", terms), ("404.html", notfound)]:
    open(os.path.join(ROOT, name), "w").write(html)

open(os.path.join(ROOT, "sitemap.xml"), "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  "".join(f"  <url><loc>{SITE_URL}{p}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority></url>\n" for p, pr in [("", "1.0"), ("partners.html", "0.6"), ("privacy.html", "0.2"), ("terms.html", "0.2")]) + "</urlset>\n")
open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /staff.html\nSitemap: {SITE_URL}sitemap.xml\n")
open(os.path.join(ROOT, "site.webmanifest"), "w").write(json.dumps({"name": NAME, "short_name": "Boat Service", "start_url": "./", "scope": "./", "display": "standalone",
  "background_color": "#f7f3ea", "theme_color": "#0b2638", "icons": [{"src": "img/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "img/icon-512.png", "sizes": "512x512", "type": "image/png"}]}, indent=2) + "\n")
print("built; phone", "REAL " + TEL if PHONE_REAL else "placeholder (call buttons hidden, no telephone in JSON-LD)")
