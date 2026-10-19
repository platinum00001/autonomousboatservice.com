#!/usr/bin/env python3
"""Builds every HTML page, sitemap.xml, robots.txt and site.webmanifest.
Run from anywhere:  python3 tools/build.py
Long copy lives in tools/content_*.py; phone/email/social live in config.js.
Links are written with "~/" (= site root) and rewritten per page depth, so the site works under
/autonomousboatservice.com/ on GitHub Pages and at the root of the custom domain later.
When autonomousboatservice.com points at GitHub Pages, change SITE_URL below, rebuild, and push."""
import json, re, os, sys, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content_services import SERVICES as SVC
from content_areas import AREAS
from content_guides import GUIDES, CHECKLIST

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = "https://platinum00001.github.io/autonomousboatservice.com/"   # -> "https://autonomousboatservice.com/" after DNS
NAME = "Autonomous Boat Service"
TODAY = datetime.date.today().isoformat()
TODAY_H = datetime.date.today().strftime("%B %-d, %Y")

cfg = open(os.path.join(ROOT, "config.js")).read()
PHONE = re.search(r'PHONE:\s*"([^"]*)"', cfg).group(1)
digits = re.sub(r"\D", "", PHONE)
PHONE_REAL = not re.search(r"coming soon|placeholder", PHONE, re.I) and len(digits) >= 10 and set(digits) != {"0"}
TEL = ("+1" + digits if len(digits) == 10 else "+" + digits) if PHONE_REAL else ""

ICON = {
 "engine": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="12" height="9" rx="2"/><path d="M15 10h3l2 2v2l-2 2h-3M7 7V4h4v3M7 16v4M11 16v4"/></svg>',
 "snow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/></svg>',
 "sun": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 "hull": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14h20l-3 5H5zM6 14V9h8l3 5M9 9V6"/></svg>',
 "bolt": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
 "paint": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="6" rx="1"/><path d="M17 6h3v5h-8v3M10 14h4v7h-4z"/></svg>',
 "van": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
 "sos": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/></svg>',
 "wrap": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c3-6 15-6 18 0M3 15h18l-2 4H5z"/><path d="M8 11V8M12 10V6M16 11V8"/></svg>',
 "spark": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
 "gear": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
 "map": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
 "shield": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
 "clock": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
}
SERVICE_LABEL = {"engine_outboard": "Outboard engine repair", "engine_inboard": "Inboard / sterndrive repair", "winterizing": "Winterizing", "shrink_wrap": "Shrink-wrap",
  "commissioning": "Spring commissioning", "hull_fiberglass": "Hull, fiberglass & gelcoat", "electrical": "Electrical & electronics", "bottom_paint": "Bottom paint",
  "mobile_dockside": "Mobile / dockside service", "emergency_towing": "Emergency / haul-out referral", "detailing": "Detailing", "storage": "Storage referral", "other": "Something else"}
REGIONS = [
 ("Upper Cape", ["falmouth", "woods-hole", "mashpee", "bourne"], ["Sandwich", "Pocasset", "Cataumet", "Waquoit"]),
 ("Mid Cape", ["barnstable-hyannis", "osterville", "dennis"], ["Centerville", "Marstons Mills", "Yarmouth"]),
 ("Lower & Outer Cape", ["harwich", "chatham", "orleans"], ["Brewster", "Eastham", "Wellfleet", "Truro", "Provincetown"]),
 ("The Islands", ["marthas-vineyard", "nantucket"], ["Edgartown", "Oak Bluffs", "Menemsha"]),
 ("South Shore & Buzzards Bay", [], ["Plymouth", "Duxbury", "Kingston", "Marshfield", "Scituate", "Hingham", "Wareham", "Marion", "Mattapoisett"]),
]
A = {a["slug"]: a for a in AREAS}
S = {s["slug"]: s for s in SVC}
FAQ = [
 ("Are you a boat repair shop?", "No. Autonomous Boat Service is a service-matching company. We take your request and connect you with an independent local marine shop that does that kind of work in your area. The shop does the work and gives you its own quote."),
 ("What does it cost?", "Sending a request is free, with no obligation. You pay the shop directly for any work you approve. Partner shops may pay us a referral fee, and that never adds anything to your bill from us."),
 ("Who sees my phone number?", "Only us, and then one shop. When we look for a match, shops first see an anonymous summary: boat, engine, the job, your general area and timing. Your name and contact details go to one matched shop, only after you're matched."),
 ("Why \"autonomous\"?", "Because the service runs itself for you. You fill in one short form, and your request is routed to a shop that fits your boat, location and timing. Robots don't work on your boat. Real local marine mechanics do."),
 ("How fast will I hear back?", "We review requests as they come in and try to match you quickly. Timing depends on the season, the job and which shops have openings. Spring launch and fall haul-out are the busiest times, so earlier is better."),
 ("What if it's an emergency on the water?", "If anyone is in danger, call 911 or hail the Coast Guard on VHF channel 16 right away. If you have a towing membership, call it directly. For the repair, once you're safe, choose \"Emergency\" on the form and we'll prioritize it."),
 ("Who are the partner shops?", "Independent marine businesses on Cape Cod, the Islands and the South Shore that apply and are approved to receive requests. We don't employ the mechanics or guarantee their work, so ask any shop about its experience, insurance and warranty before you hire it."),
 ("Can I find a part through you?", "Yes. Use the parts request form with the part name or number and your engine or boat details. We pass it to partner shops and parts counters. We don't stock parts or set prices."),
]
PLANS = [
 ("seasonal", "Seasonal Care", "Fall winterization and spring commissioning with the same shop, so your boat keeps its spot on the list.", ["Fall haul-out coordination and winterizing", "Shrink-wrap or cover", "Spring commissioning and launch", "One point of contact all year"], "winterizing"),
 ("engine", "Engine Care", "Service on your engine maker's schedule: hours-based and annual, with records kept for resale.", ["Annual or hours-based service", "Impeller, filters, fluids and plugs", "Gear oil and seal checks", "Service history for resale"], "engine_outboard"),
 ("dockside", "Dockside Care", "In-season checks and washdowns at your slip or mooring, scheduled before big weekends.", ["Pre-season and mid-season checks", "Washdowns and canvas care", "Battery and bilge checks", "Priority for in-season problems, where the shop offers it"], "mobile_dockside"),
 ("storage", "Haul-Out & Storage", "Storage found and booked for you, with haul, wrap and launch handled by one yard.", ["Indoor, outdoor or rack storage referral", "Hauling and transport", "Winter projects quoted while the boat is out", "Launch date requested up front"], "storage"),
 ("fleet", "Fleets & Associations", "For rental fleets, clubs, HOAs and launch services that need several boats handled together.", ["Multiple boats on one request", "Season-long scheduling", "Single point of contact", "Consolidated quotes from shops"], "other"),
]

def esc(s): return str(s).replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
CALL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>'
WAVES = '<svg class="waves" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path fill="#0e7d8c" opacity=".55" d="M0 40c120 25 240 25 360 0s240-25 360 0 240 25 360 0 240-25 360 0v50H0z"/><path fill="#f7f3ea" d="M0 62c120 18 240 18 360 0s240-18 360 0 240 18 360 0 240-18 360 0v28H0z"/></svg>'
BIZ_ID = SITE_URL + "#business"

def biz_ld():
    b = {"@context": "https://schema.org", "@type": "ProfessionalService", "@id": BIZ_ID,
      "name": NAME, "url": SITE_URL, "logo": SITE_URL + "img/icon-512.png", "image": SITE_URL + "og.jpg",
      "description": "Boat repair and service matching for Cape Cod, Martha's Vineyard, Nantucket and the South Shore. One request connects boaters with independent local marine repair shops.",
      "slogan": "Boat repair, matched fast.", "priceRange": "Free to request",
      "areaServed": [{"@type": "City", "name": t + ", MA"} for t in ["Falmouth", "Bourne", "Mashpee", "Sandwich", "Barnstable", "Yarmouth", "Dennis", "Harwich", "Chatham", "Orleans", "Eastham", "Wellfleet", "Provincetown", "Edgartown", "Oak Bluffs", "Tisbury", "Nantucket", "Plymouth", "Duxbury", "Marshfield", "Scituate", "Hingham", "Wareham", "Marion", "Mattapoisett"]]
                   + [{"@type": "AdministrativeArea", "name": n} for n in ["Cape Cod", "Martha's Vineyard", "Nantucket", "South Shore, Massachusetts"]],
      "knowsAbout": [s["name"] for s in SVC],
      "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Boat service matching",
         "itemListElement": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": s["name"], "url": SITE_URL + "services/" + s["slug"] + ".html"}} for s in SVC]}}
    if PHONE_REAL: b["telephone"] = TEL
    return b
def provider(): return {"@type": "ProfessionalService", "@id": BIZ_ID, "name": NAME, "url": SITE_URL}
def faq_ld(items): return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]}
def crumbs_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE_URL + p} for i, (n, p) in enumerate(items)]}
def ld_tags(objs): return "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in objs)
def crumbs_html(items):
    return '<nav class="crumbs" aria-label="Breadcrumb"><ol>' + "".join(
        (f'<li><a href="~/{p}">{esc(n)}</a></li>' if i < len(items) - 1 else f'<li aria-current="page">{esc(n)}</li>') for i, (n, p) in enumerate(items)) + "</ol></nav>"

def head(title, desc, path, extra="", og="og.jpg", noindex=False):
    url = SITE_URL + path
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
{'<meta name="robots" content="noindex,nofollow">' + chr(10) if noindex else ''}<meta name="theme-color" content="#0b2638">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE_URL}{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{NAME}: boat repair, matched fast on Cape Cod and the Islands">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{SITE_URL}{og}">
<link rel="icon" href="~/favicon.svg" type="image/svg+xml">
<link rel="icon" href="~/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="~/apple-touch-icon.png">
<link rel="manifest" href="~/site.webmanifest">
<link rel="stylesheet" href="~/css/styles.css">
{extra}</head>
'''

NAV = [("services/", "Services", "services"), ("areas/", "Areas", "areas"), ("parts.html", "Parts", "parts"), ("plans.html", "Plans", "plans"),
       ("guides/", "Guides", "guides"), ("partners.html", "For shops", "partners")]
def header(cur=""):
    links = "".join(f'<a href="~/{h}" class="hide-sm"{" aria-current=page" if k == cur else ""}>{l}</a>' for h, l, k in NAV)
    mlinks = "".join(f'<a href="~/{h}">{l}</a>' for h, l, k in NAV + [("about.html", "Why us", "about"), ("account.html", "My account", "account")])
    return f'''<body data-root="~/">
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap navbar">
  <a class="brand" href="~/index.html"><img src="~/img/logo.svg" alt="" width="40" height="40"><span><small>Autonomous</small><b>Boat Service</b></span></a>
  <nav class="navlinks" aria-label="Main">
    {links}
    <a href="~/account.html" class="hide-sm acct"{" aria-current=page" if cur == "account" else ""}>Sign in</a>
    <a class="btn sm sea" data-call hidden href="#">{CALL_ICON}<span>Call</span></a>
    <a class="btn sm" href="~/quote.html">Get a quote</a>
    <details class="mnav"><summary aria-label="Menu"><span></span><span></span><span></span></summary><div class="mnav-panel">{mlinks}</div></details>
  </nav>
</div></header>
<main id="main">
'''

def footer():
    svc = "".join(f'<li><a href="~/services/{s["slug"]}.html">{esc(s["name"])}</a></li>' for s in SVC[:7])
    ars = "".join(f'<li><a href="~/areas/{a["slug"]}.html">{esc(a["name"])}</a></li>' for a in AREAS)
    return f'''</main>
<footer class="site"><div class="wrap">
  <div class="cols cols5">
    <div>
      <a class="brand" href="~/index.html" style="color:#fff"><img src="~/img/logo.svg" alt="" width="40" height="40"><span><small style="color:#7fd3dc">Autonomous</small><b style="color:#fff">Boat Service</b></span></a>
      <p style="margin-top:12px">Boat service matching for Cape Cod, the Islands and the South Shore. One request connects you with an independent local shop.</p>
      <p data-call hidden><a data-call hidden href="#"><span data-phone-text></span></a></p>
      <p data-email hidden><a href="#"></a></p>
      <div id="social"></div>
    </div>
    <div><h3>Boaters</h3><ul>
      <li><a href="~/quote.html">Get a quote</a></li><li><a href="~/parts.html">Find a part</a></li><li><a href="~/plans.html">Maintenance plans</a></li>
      <li><a href="~/guides/">Guides</a></li><li><a href="~/guides/seasonal-maintenance-checklist.html">Seasonal checklist</a></li><li><a href="~/about.html">Why us</a></li><li><a href="~/account.html">My account</a></li>
    </ul></div>
    <div><h3>Services</h3><ul>{svc}<li><a href="~/services/">All services</a></li></ul></div>
    <div><h3>Areas</h3><ul class="two-col">{ars}</ul></div>
    <div><h3>Shops &amp; legal</h3><ul>
      <li><a href="~/partners.html">Partner with us</a></li><li><a href="~/privacy.html">Privacy</a></li><li><a href="~/privacy.html#data-deletion">Delete my data</a></li>
      <li><a href="~/terms.html">Terms</a></li><li><a href="~/staff.html">Staff login</a></li>
    </ul></div>
  </div>
  <p class="fine">{NAME} is a service-matching company. We don't perform repairs. All work is done by independent marine businesses, which set their own prices and warranties. In an emergency on the water, call 911 or the U.S. Coast Guard on VHF channel 16. &copy; <span data-year>2026</span> {NAME}.</p>
</div></footer>
<script src="~/config.js"></script>
<script src="~/js/app.js"></script>
'''

PAGES = {}   # path -> html
SITEMAP = []  # (path, priority)
def page(path, title, desc, body, cur="", ld=(), scripts=(), og="og.jpg", noindex=False, priority="0.6", extra=""):
    html = head(title, desc, path, ld_tags(ld) + extra, og, noindex) + header(cur) + body + footer() + "".join(f'<script src="~/js/{s}"></script>\n' for s in scripts) + "</body>\n</html>\n"
    PAGES[path] = html
    if not noindex: SITEMAP.append((path, priority))

def service_options(selected=""):
    return '<option value="">Choose a service…</option>' + "".join(f'<option value="{k}"{" selected" if k == selected else ""}>{v}</option>' for k, v in SERVICE_LABEL.items())

CONSENT = (f"I agree that {NAME} may share a summary of my request, <strong>without my name or contact details</strong>, with partner repair shops, "
           "and share my contact details with <strong>one matched partner shop only after I'm matched</strong> with it. (Required. See our <a href=\"~/privacy.html\">privacy policy</a>.)")

def quote_form():
    return f'''<div class="quote-wrap">
  <div>
    <p class="eyebrow">Get a quote</p>
    <h2>Tell us what your boat needs</h2>
    <p class="lead">It takes about two minutes. A local shop will contact you with timing and a price.</p>
    <ul class="ticks">
      <li>Free, with no obligation.</li>
      <li><strong>Your contact details stay private</strong> until you're matched with one shop.</li>
      <li>Photos help shops quote faster (optional).</li>
      <li><a href="~/account.html">Sign in</a> (optional) to track your requests.</li>
    </ul>
    <p class="hint"><strong>On the water and in danger?</strong> Call 911 or the Coast Guard on VHF 16 first.</p>
    <p data-call hidden>Prefer to talk? <a data-call hidden href="#"><span data-phone-text></span></a></p>
  </div>
  <div>
  <form class="panel" id="quote-form" novalidate>
    <p class="signed-in-note" data-signed-in hidden>Signed in as <b data-signed-email></b>. This request will show on <a href="~/account.html">your account</a>.</p>
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
      <div class="field"><label for="q-engine">Engine</label><input id="q-engine" name="engine" type="text" maxlength="160" placeholder="e.g. Yamaha F90 outboard, 2016 / twin MerCruiser 5.0"></div>
      <div class="field"><label for="q-loc">Location or marina</label><input id="q-loc" name="location" type="text" required maxlength="160" placeholder="e.g. Falmouth Inner Harbor, or a mooring or trailer in Mashpee"><p class="hint">Shops see only the town until you're matched.</p></div>
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
    <label class="check consent"><input type="checkbox" name="consent_share" required> <span>{CONSENT}</span></label>
    <button class="btn" type="submit" style="width:100%">Send my request</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <div class="success" id="quote-success" hidden>
    <h3>Request received. Thank you!</h3>
    <p>We're looking for a local shop now. Once you're matched, that one shop will contact you at the phone number you gave, to confirm the details, timing and a quote.</p>
    <p data-urgent hidden><strong>Marked as an emergency.</strong> If anyone is in danger, call 911 or the Coast Guard on VHF 16. If you have a towing membership, call it directly.</p>
    <p data-account-link hidden>You can follow it on <a href="~/account.html">your account</a>.</p>
  </div>
  </div>
</div>'''

def parts_form():
    return f'''<form class="panel" id="parts-form" novalidate>
    <p class="signed-in-note" data-signed-in hidden>Signed in as <b data-signed-email></b>. This request will show on <a href="~/account.html">your account</a>.</p>
    <fieldset><legend>The part</legend>
      <div class="two">
        <div class="field"><label for="pt-name">Part name</label><input id="pt-name" name="part_name" type="text" required maxlength="160" placeholder="e.g. water pump impeller kit"></div>
        <div class="field"><label for="pt-num">Part number <span class="opt">(if known)</span></label><input id="pt-num" name="part_number" type="text" maxlength="80" placeholder="e.g. 6CE-W0078-00"></div>
      </div>
      <div class="three">
        <div class="field"><label for="pt-make">Engine or boat make</label><input id="pt-make" name="make" type="text" required maxlength="80" placeholder="e.g. Yamaha"></div>
        <div class="field"><label for="pt-model">Model</label><input id="pt-model" name="model" type="text" maxlength="80" placeholder="e.g. F150"></div>
        <div class="field"><label for="pt-year">Year</label><input id="pt-year" name="model_year" type="number" min="1940" max="2100" inputmode="numeric" placeholder="2016"></div>
      </div>
      <div class="field"><label for="pt-serial">Serial number <span class="opt">(optional, helps exact matches)</span></label><input id="pt-serial" name="serial" type="text" maxlength="80"></div>
      <div class="field"><label for="pt-details">Notes <span class="opt">(optional)</span></label><textarea id="pt-details" name="details" maxlength="2000" placeholder="Quantity, condition (new / used / either), anything that helps identify it"></textarea></div>
      <div class="field"><label for="pt-photos">Photos <span class="opt">(optional, up to 4: the old part, labels, data plates)</span></label><input id="pt-photos" name="photos" type="file" accept="image/*" multiple></div>
    </fieldset>
    <fieldset><legend>Getting it to you</legend>
      <div class="two">
        <div class="field"><label for="pt-ful">Pickup or ship?</label><select id="pt-ful" name="fulfillment"><option value="either">Either is fine</option><option value="pickup">I'll pick it up</option><option value="ship">Ship it to me</option></select></div>
        <div class="field"><label for="pt-loc">Your town or ZIP</label><input id="pt-loc" name="location" type="text" required maxlength="160" placeholder="e.g. Falmouth or 02540"></div>
      </div>
    </fieldset>
    <fieldset><legend>You</legend>
      <div class="field"><label for="pt-cname">Name</label><input id="pt-cname" name="name" type="text" required maxlength="120" autocomplete="name"></div>
      <div class="two">
        <div class="field"><label for="pt-phone">Phone</label><input id="pt-phone" name="phone" type="tel" required maxlength="30" autocomplete="tel"></div>
        <div class="field"><label for="pt-email">Email <span class="opt">(optional)</span></label><input id="pt-email" name="email" type="email" maxlength="200" autocomplete="email"></div>
      </div>
    </fieldset>
    <div class="hp" aria-hidden="true"><label for="pt-web">Website</label><input id="pt-web" name="website_url" type="text" tabindex="-1" autocomplete="off"></div>
    <label class="check consent"><input type="checkbox" name="consent_share" required> <span>{CONSENT}</span></label>
    <button class="btn" type="submit" style="width:100%">Send parts request</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <div class="success" id="parts-success" hidden><h3>Parts request received.</h3><p>We're checking with partner shops and parts counters. The shop that can supply it will contact you with availability and price. We don't stock parts or set prices.</p><p data-account-link hidden>Track it on <a href="~/account.html">your account</a>.</p></div>'''

def service_cards(items):
    return "".join(f'''<a class="card link-card" href="~/services/{s["slug"]}.html"><div class="icon">{ICON[s["icon"]]}</div><h3>{esc(s["name"])}</h3><p>{esc(s["short"])}</p><span class="more">Learn more →</span></a>''' for s in items)
def area_cards(slugs):
    return "".join(f'<a class="chip-link" href="~/areas/{s}.html">{esc(A[s]["name"])}</a>' for s in slugs)
def faq_html(items): return "".join(f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in items)
def cta_band(title="Ready when you are", text="One request. The right local shop.", href="~/quote.html", label="Get a quote"):
    return f'<section class="cta-band"><div class="wrap"><h2>{title}</h2><p style="margin:0">{text}</p><a class="btn light" href="{href}">{label}</a></div></section>'

HOW = '''<div class="grid steps">
    <div class="card"><span class="num">1</span><h3>Tell us about the job</h3><p>Your boat, the engine, what's wrong, where it's kept and how soon you need it. Add photos if you have them. It takes two minutes.</p></div>
    <div class="card"><span class="num">2</span><h3>We match a shop, privately</h3><p>Approved local shops that do your kind of work see an anonymous summary: boat, engine, job, town and timing. Shops that can take it tell us.</p></div>
    <div class="card"><span class="num">3</span><h3>One shop contacts you</h3><p>We pass your contact details to the one shop that fits best. It confirms details, timing and price, and you decide. You pay the shop directly.</p></div>
  </div>'''
WHY = [("shield", "Your number stays private", "No lead-blasting. Shops see an anonymous summary first, and only the one shop you're matched with gets your contact details."),
       ("gear", "Matched to your engine", "We route by engine brand, type of work, your town and your timing, so the shop that calls you actually works on your boat."),
       ("map", "Local, Cape to Islands", "From Bourne to Provincetown, Martha's Vineyard and Nantucket, we know the harbors, the seasons and the logistics."),
       ("clock", "One request, not ten calls", "Stop calling around the harbor in May. Send one request and let the right shop come to you."),
       ("van", "Dockside and driveway too", "Many partner shops are mobile, so a lot of jobs can be done where your boat already is."),
       ("spark", "Free for boaters", "No fees and no obligation. Shops quote you directly, and you only pay for work you approve.")]
def why_grid(): return '<div class="grid cards">' + "".join(f'<div class="card"><div class="icon">{ICON[i]}</div><h3>{t}</h3><p>{d}</p></div>' for i, t, d in WHY) + "</div>"

# ------------------------------------------------------------------ index
regions_html = "".join(f'<div class="region"><h3>{r}</h3><div class="chips-row">' + area_cards(sl) + "".join(f'<span class="chip-plain">{esc(t)}</span>' for t in extra) + "</div></div>" for r, sl, extra in REGIONS)
guides_cards = "".join(f'<a class="card link-card" href="~/guides/{g["slug"]}.html"><p class="eyebrow">Guide · {g["read"]} read</p><h3>{esc(g["title"])}</h3><p>{esc(g["desc"])}</p><span class="more">Read →</span></a>' for g in GUIDES[:3])
page("", f"Boat Repair & Service on Cape Cod and the Islands | {NAME}",
  "Need boat repair on Cape Cod, Martha's Vineyard or Nantucket? One request matches you with an independent local shop for engines, winterizing, shrink-wrap, fiberglass, electrical, bottom paint, parts and dockside service.",
  f'''
<section class="hero">
  <div class="wrap">
    <div>
      <p class="eyebrow">Cape Cod · Martha's Vineyard · Nantucket · South Shore</p>
      <h1>Boat repair, matched fast.</h1>
      <p class="lead">Tell us what your boat needs once. We match you with an independent local repair shop that does that work on your engine, in your harbor, when you need it.</p>
      <div class="ctas">
        <a class="btn" href="~/quote.html">Get a quote</a>
        <a class="btn light" data-call hidden href="#">{CALL_ICON}<span>Call <span data-phone-text></span></span></a>
        <a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.35)" href="#how">How it works</a>
      </div>
      <p class="note">Free to request, with no obligation. Your contact details go to one matched shop only.</p>
    </div>
    <aside class="hero-card" aria-label="In short">
      <h2>One request. The right shop.</h2>
      <ol>
        <li>Two-minute form: your boat, the problem, where it's kept.</li>
        <li>Approved local shops see an anonymous summary and raise their hand.</li>
        <li>The best-fit shop contacts you with timing and a quote. You decide.</li>
      </ol>
      <p style="margin:6px 0 12px"><a href="~/parts.html" style="color:#7fd3dc">Looking for a part? →</a></p>
    </aside>
  </div>
  {WAVES}
</section>
<div class="strip"><div class="wrap"><ul>
  <li>Free for boaters</li><li>Outboards, inboards &amp; sterndrives</li><li>Dockside, mooring &amp; driveway</li><li>Cape, Islands &amp; South Shore</li>
</ul></div></div>

<section class="block" id="services"><div class="wrap">
  <p class="eyebrow">Services</p>
  <h2>Everything your boat needs, one request away</h2>
  <p class="lead">We match requests for the jobs Cape boaters need most, from a no-start at the mooring to a full winter refit.</p>
  <div class="grid cards" style="margin-top:24px">{service_cards(SVC)}</div>
</div></section>

<section class="block alt" id="how"><div class="wrap">
  <p class="eyebrow">How it works</p>
  <h2>Smart matching, real local mechanics</h2>
  <p class="lead">"Autonomous" means boat service that runs itself for you. Your request is routed to the right shop, so you don't have to call around the harbor.</p>
  <div style="margin-top:24px">{HOW}</div>
</div></section>

<section class="block" id="why"><div class="wrap">
  <p class="eyebrow">Why boaters use us</p>
  <h2>Built around how Cape boating actually works</h2>
  <div style="margin-top:24px">{why_grid()}</div>
  <p style="margin-top:18px"><a href="~/about.html">More about how we work →</a></p>
</div></section>

<section class="block alt" id="plans"><div class="wrap split">
  <div>
    <p class="eyebrow">Maintenance plans</p>
    <h2>Set it up once for the whole season</h2>
    <p class="lead">Seasonal Care, Engine Care, Dockside Care, Haul-Out &amp; Storage, and plans for fleets. Each plan is arranged with a partner shop, which quotes it to you.</p>
    <p><a class="btn sea" href="~/plans.html">See plans</a></p>
  </div>
  <div class="card"><h3>Book on the Cape's calendar</h3><ul class="ticks"><li><strong>Jan to Mar:</strong> book commissioning and winter projects</li><li><strong>Apr to May:</strong> launch rush, so book early</li><li><strong>Jul to Aug:</strong> book fall haul-out and storage</li><li><strong>Sep to Nov:</strong> winterize and wrap</li></ul><p><a href="~/guides/seasonal-maintenance-checklist.html">Seasonal checklist →</a></p></div>
</div></section>

<section class="block" id="area"><div class="wrap">
  <p class="eyebrow">Service area</p>
  <h2>Cape Cod, the Islands &amp; the South Shore</h2>
  <p class="lead">Based in Falmouth on the Upper Cape, we match requests across the Cape, Martha's Vineyard, Nantucket and the South Shore. Pick your area for local notes.</p>
  <div class="regions">{regions_html}</div>
  <p class="hint">Kept somewhere else? Send your request anyway. If we can't match you, we'll tell you.</p>
</div></section>

<section class="block alt" id="guides"><div class="wrap">
  <p class="eyebrow">Guides</p>
  <h2>Useful before you call anyone</h2>
  <div class="grid cards" style="margin-top:20px">{guides_cards}</div>
  <p style="margin-top:16px"><a href="~/guides/">All guides →</a></p>
</div></section>

<section class="block" id="testimonials" hidden aria-hidden="true" data-placeholder="testimonials">
  <!-- Placeholder only. Add REAL testimonials from real customers, with their permission, then remove "hidden". Never invent reviews. -->
  <div class="wrap"><p class="eyebrow">What boaters say</p><h2>Testimonials</h2><div class="grid cards" id="testimonial-list"></div></div>
</section>

<section class="block alt" id="quote"><div class="wrap">{quote_form()}</div></section>

<section class="block faq" id="faq"><div class="wrap narrow">
  <p class="eyebrow">FAQ</p>
  <h2>Questions boaters ask</h2>
  {faq_html(FAQ)}
</div></section>
{cta_band("Run a marine repair shop?", "Get anonymous job requests in your towns. Say yes only to the ones you want.", "~/partners.html", "Partner with us")}
''', ld=[biz_ld(), faq_ld(FAQ), {"@context": "https://schema.org", "@type": "WebSite", "name": NAME, "url": SITE_URL}], scripts=["forms.js"], priority="1.0")

# ------------------------------------------------------------------ quote page
page("quote.html", f"Get a Boat Repair Quote on Cape Cod | {NAME}",
  "Request a boat repair or service quote on Cape Cod, Martha's Vineyard or Nantucket. Free, no obligation. Your contact details go to one matched local shop only.",
  crumbs_html([("Home", ""), ("Get a quote", "quote.html")]).replace('<nav class="crumbs"', '<div class="wrap"><nav class="crumbs"', 1).replace("</nav>", "</nav></div>", 1) +
  f'<section class="block"><div class="wrap">{quote_form()}</div></section>', cur="", scripts=["forms.js"],
  ld=[crumbs_ld([("Home", ""), ("Get a quote", "quote.html")])], priority="0.9")

def crumbs_bar(items): return '<div class="crumbs-bar"><div class="wrap">' + crumbs_html(items) + "</div></div>"
def page_head(eyebrow, h1, lead, extra=""):
    return f'<section class="page-head"><div class="wrap"><p class="eyebrow" style="color:#7fd3dc">{eyebrow}</p><h1>{h1}</h1><p class="lead">{lead}</p>{extra}</div></section>'

# ------------------------------------------------------------------ services
page("services/", f"Boat Repair & Marine Services on Cape Cod | {NAME}",
  "Engine repair, winterizing and shrink-wrap, spring commissioning, fiberglass, bottom paint, electrical, mobile service, detailing and storage on Cape Cod and the Islands.",
  crumbs_bar([("Home", ""), ("Services", "services/")]) + page_head("Services", "Boat services we match on Cape Cod &amp; the Islands",
  "Pick a service to see what's involved, what to ask a shop and how to get a quote. Or <a href=\"~/quote.html\" style=\"color:#fff\">send a request</a> now.") +
  f'<section class="block"><div class="wrap"><div class="grid cards">{service_cards(SVC)}</div>'
  f'<div class="card" style="margin-top:22px"><div class="icon">{ICON["gear"]}</div><h3>Parts</h3><p>Looking for a specific part? Send the part name or number and your engine details, and we\'ll ask partner shops and parts counters.</p><p><a href="~/parts.html">Find a part →</a></p></div></div></section>' + cta_band(),
  cur="services", og="og-services.jpg", ld=[crumbs_ld([("Home", ""), ("Services", "services/")]),
  {"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": SITE_URL + "services/" + s["slug"] + ".html", "name": s["name"]} for i, s in enumerate(SVC)]}], priority="0.8")

for s in SVC:
    path = f"services/{s['slug']}.html"
    cr = [("Home", ""), ("Services", "services/"), (s["name"], path)]
    rel = [x for x in SVC if x["slug"] != s["slug"]][:3]
    areas_for = [a["slug"] for a in AREAS if s["slug"] in a["popular"]] or ["falmouth", "barnstable-hyannis", "chatham"]
    body = crumbs_bar(cr) + page_head("Service · Cape Cod &amp; the Islands", esc(s["h1"]), esc(s["intro"]),
        f'<div class="ctas" style="margin-top:18px"><a class="btn" href="~/quote.html?service={s["key"]}">Get a quote</a> <a class="btn light" data-call hidden href="#">{CALL_ICON}<span>Call</span></a></div>') + f'''
<section class="block"><div class="wrap split">
  <div>
    <h2>What's included</h2>
    <ul class="ticks">{"".join(f"<li>{esc(i)}</li>" for i in s["includes"])}</ul>
    <h2 style="margin-top:28px">Signs you need it</h2>
    <ul>{"".join(f"<li>{esc(i)}</li>" for i in s["signs"])}</ul>
  </div>
  <aside>
    <div class="card"><h3>On Cape Cod &amp; the Islands</h3><p>{esc(s["local"])}</p></div>
    <div class="card" style="margin-top:16px"><h3>Questions to ask any shop</h3><ul>{"".join(f"<li>{esc(i)}</li>" for i in s["ask"])}</ul></div>
    <div class="card cta-card" style="margin-top:16px"><h3>Get matched for this job</h3><p>One request. Your contact details stay private until you're matched with one shop.</p><a class="btn" href="~/quote.html?service={s["key"]}">Request {esc(s["name"].lower())}</a></div>
  </aside>
</div></section>
<section class="block alt"><div class="wrap">
  <h2>How it works</h2>{HOW}
</div></section>
<section class="block faq"><div class="wrap narrow"><p class="eyebrow">FAQ</p><h2>{esc(s["name"])}: common questions</h2>{faq_html(s["faq"])}</div></section>
<section class="block alt"><div class="wrap">
  <h2>Popular areas for this service</h2><div class="chips-row">{area_cards(areas_for)}</div>
  <h2 style="margin-top:26px">Related services</h2><div class="grid cards">{service_cards(rel)}</div>
</div></section>
''' + cta_band(f"Need {esc(s['name'].lower())}?", "Free to request, with no obligation.", f"~/quote.html?service={s['key']}", "Get a quote")
    page(path, f"{s['seo_title']} | {NAME}", s["seo_desc"], body, cur="services", og="og-services.jpg",
         ld=[{"@context": "https://schema.org", "@type": "Service", "name": s["name"], "serviceType": s["name"], "description": s["seo_desc"], "url": SITE_URL + path,
              "provider": provider(), "areaServed": [{"@type": "AdministrativeArea", "name": n} for n in ["Cape Cod", "Martha's Vineyard", "Nantucket", "South Shore, Massachusetts"]],
              "offers": {"@type": "Offer", "description": "Free to request. The matched shop quotes the work directly."}},
             faq_ld(s["faq"]), crumbs_ld(cr)], priority="0.8")

# ------------------------------------------------------------------ areas
page("areas/", f"Boat Repair by Town: Cape Cod, Martha's Vineyard & Nantucket | {NAME}",
  "Boat repair and service matching by town: Falmouth, Woods Hole, Mashpee, Bourne, Hyannis, Osterville, Dennis, Harwich, Chatham, Orleans, Martha's Vineyard and Nantucket.",
  crumbs_bar([("Home", ""), ("Areas", "areas/")]) + page_head("Service area", "Where we match boat service", "From the Canal to Provincetown, and out to the Islands. Pick your area for local notes, then send one request.") +
  f'<section class="block"><div class="wrap"><div class="regions">{regions_html}</div></div></section>' + cta_band(),
  cur="areas", og="og-areas.jpg", ld=[crumbs_ld([("Home", ""), ("Areas", "areas/")])], priority="0.8")

for a in AREAS:
    path = f"areas/{a['slug']}.html"
    cr = [("Home", ""), ("Areas", "areas/"), (a["name"], path)]
    pop = [S[x] for x in a["popular"]]
    body = crumbs_bar(cr) + page_head(f"{esc(a['region'])}", f"Boat repair &amp; service in {esc(a['name'])}",
        f"One request matches you with an independent local shop for boats in {esc(a['waters'])}.",
        f'<div class="ctas" style="margin-top:18px"><a class="btn" href="~/quote.html?town={esc(a["name"].split(" &")[0])}">Get a quote in {esc(a["name"].split(" &")[0])}</a></div>') + f'''
<section class="block"><div class="wrap split">
  <div class="prose">{"".join(f"<p>{esc(p)}</p>" for p in a["body"])}
    <p class="hint">We're a service-matching company. Shops in and around {esc(a["name"])} apply to receive requests, and the shop you're matched with does the work and quotes you directly.</p>
  </div>
  <aside>
    <div class="card"><h3>Waters we cover here</h3><p>{esc(a["waters"][0].upper() + a["waters"][1:])}.</p></div>
    <div class="card cta-card" style="margin-top:16px"><h3>Send one request</h3><p>Tell us the boat, the job and where it's kept. Shops see only the town until you're matched.</p><a class="btn" href="~/quote.html?town={esc(a["name"].split(" &")[0])}">Get a quote</a></div>
  </aside>
</div></section>
<section class="block alt"><div class="wrap"><h2>Popular requests in {esc(a["name"])}</h2><div class="grid cards">{service_cards(pop)}</div></div></section>
<section class="block faq"><div class="wrap narrow"><p class="eyebrow">FAQ</p><h2>{esc(a["name"])} questions</h2>{faq_html(a["faq"])}</div></section>
<section class="block alt"><div class="wrap"><h2>Nearby areas</h2><div class="chips-row">{area_cards(a["nearby"])}</div></div></section>
''' + cta_band(f"Boat in {esc(a['name'])}?", "Free to request, with no obligation.", f"~/quote.html?town={esc(a['name'].split(' &')[0])}", "Get a quote")
    page(path, f"{a['seo_title']} | {NAME}", a["seo_desc"], body, cur="areas", og="og-areas.jpg",
         ld=[{"@context": "https://schema.org", "@type": "Service", "name": f"Boat repair and service matching in {a['name']}", "serviceType": "Boat repair and service matching",
              "url": SITE_URL + path, "provider": provider(), "areaServed": {"@type": "City", "name": a["city"] + ", MA"} if a["region"] != "The Islands" else {"@type": "AdministrativeArea", "name": a["name"]}},
             faq_ld(a["faq"]), crumbs_ld(cr)], priority="0.7")

# ------------------------------------------------------------------ guides
check_html = "".join(f'<div class="card"><h3>{esc(m)}</h3><ul class="checks">' + "".join(f"<li>{esc(i)}</li>" for i in items) + "</ul></div>" for m, items in CHECKLIST)
all_guides = GUIDES + [{"slug": "seasonal-maintenance-checklist", "title": "Seasonal boat maintenance checklist for Cape Cod", "desc": "Month-by-month boat care for Cape Cod and Islands boaters, from booking commissioning in winter to storm season and layup.", "read": "4 min"}]
gcards = "".join(f'<a class="card link-card" href="~/guides/{g["slug"]}.html"><p class="eyebrow">Guide · {g["read"]} read</p><h3>{esc(g["title"])}</h3><p>{esc(g["desc"])}</p><span class="more">Read →</span></a>' for g in all_guides)
page("guides/", f"Boat Care Guides for Cape Cod Boaters | {NAME}",
  "Practical boat care guides for Cape Cod and the Islands: winterizing an outboard, spring commissioning, choosing bottom paint, outboard no-start checks and a seasonal checklist.",
  crumbs_bar([("Home", ""), ("Guides", "guides/")]) + page_head("Guides", "Boat care guides for Cape Cod boaters", "Plain-English, local and useful, whether you do it yourself or hire a shop.") +
  f'<section class="block"><div class="wrap"><div class="grid cards">{gcards}</div></div></section>' + cta_band(),
  cur="guides", og="og-guides.jpg", ld=[crumbs_ld([("Home", ""), ("Guides", "guides/")])], priority="0.7")

def article_ld(g, path):
    return {"@context": "https://schema.org", "@type": "Article", "headline": g["title"], "description": g["desc"], "url": SITE_URL + path,
            "datePublished": TODAY, "dateModified": TODAY, "author": {"@type": "Organization", "name": NAME, "url": SITE_URL},
            "publisher": {"@type": "Organization", "name": NAME, "logo": {"@type": "ImageObject", "url": SITE_URL + "img/icon-512.png"}},
            "image": SITE_URL + "og-guides.jpg", "mainEntityOfPage": SITE_URL + path}
for g in GUIDES:
    path = f"guides/{g['slug']}.html"
    cr = [("Home", ""), ("Guides", "guides/"), (g["title"], path)]
    sv = S[g["service"]]
    others = "".join(f'<li><a href="~/guides/{x["slug"]}.html">{esc(x["title"])}</a></li>' for x in all_guides if x["slug"] != g["slug"])
    body = crumbs_bar(cr) + f'''<article class="block"><div class="wrap narrow prose article">
  <p class="eyebrow">Guide · {g["read"]} read · Updated {TODAY_H}</p>
  <h1>{esc(g["title"])}</h1>
  <p class="lead">{esc(g["desc"])}</p>
  {g["html"]}
  <h2>Common questions</h2>{faq_html(g["faq"])}
  <div class="card cta-card" style="margin-top:26px"><h3>Rather have a pro handle it?</h3><p>Send one request and we'll match you with a local shop for {esc(sv["name"].lower())}.</p><a class="btn" href="~/quote.html?service={sv["key"]}">Get a quote</a> <a class="btn ghost" href="~/services/{sv["slug"]}.html">About this service</a></div>
  <p class="hint" style="margin-top:20px">This guide is general information, not a substitute for your engine or boat maker's instructions. When in doubt, ask a qualified marine mechanic.</p>
  <h2>More guides</h2><ul>{others}</ul>
</div></article>'''
    page(path, f"{g['seo_title']} | {NAME}", g["desc"], body, cur="guides", og="og-guides.jpg", ld=[article_ld(g, path), faq_ld(g["faq"]), crumbs_ld(cr)], priority="0.6")

ck = all_guides[-1]; path = "guides/seasonal-maintenance-checklist.html"; cr = [("Home", ""), ("Guides", "guides/"), (ck["title"], path)]
page(path, f"Seasonal Boat Maintenance Checklist for Cape Cod | {NAME}", ck["desc"],
  crumbs_bar(cr) + f'''<section class="block"><div class="wrap">
  <p class="eyebrow">Checklist · Updated {TODAY_H}</p><h1>{esc(ck["title"])}</h1>
  <p class="lead">Cape boating runs on a calendar. Yards book up in waves, so the trick is to book each job one season ahead. Print this, or keep it on your phone.</p>
  <p><button class="btn sm ghost" type="button" onclick="window.print()">Print checklist</button></p>
  <div class="grid cards months">{check_html}</div>
  <div class="card cta-card" style="margin-top:24px"><h3>Want it handled for you?</h3><p>Our Seasonal Care plan covers fall layup and spring launch with one partner shop.</p><a class="btn" href="~/plans.html">See plans</a> <a class="btn ghost" href="~/quote.html">Get a quote</a></div>
</div></section>''', cur="guides", og="og-guides.jpg",
  ld=[article_ld(ck, path), {"@context": "https://schema.org", "@type": "ItemList", "name": ck["title"], "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": m} for i, (m, _) in enumerate(CHECKLIST)]}, crumbs_ld(cr)], priority="0.6")

# ------------------------------------------------------------------ plans
plan_cards = "".join(f'''<div class="card plan" id="plan-{k}"><h3>{esc(n)}</h3><p>{esc(d)}</p><ul class="ticks">{"".join(f"<li>{esc(i)}</li>" for i in items)}</ul>
<p class="price">Pricing: request a quote</p><a class="btn sea" href="~/quote.html?service={svc}&amp;plan={k}">Request pricing</a></div>''' for k, n, d, items, svc in PLANS)
page("plans.html", f"Boat Maintenance Plans on Cape Cod | {NAME}",
  "Seasonal Care, Engine Care, Dockside Care, Haul-Out & Storage and fleet plans for Cape Cod and Islands boats, arranged with a local partner shop. Request pricing.",
  crumbs_bar([("Home", ""), ("Plans", "plans.html")]) + page_head("Maintenance plans", "Set up your boat's whole season once", "Plans are arranged with an independent partner shop near your boat. The shop sets the price and does the work. We set it up and stay your point of contact.") +
  f'''<section class="block"><div class="wrap"><div class="grid cards plans">{plan_cards}</div>
  <p class="hint" style="margin-top:18px">No prices are listed because every boat, engine and harbor is different. The matched shop quotes the plan directly, and you can say no.</p></div></section>''' + cta_band(),
  cur="plans", ld=[crumbs_ld([("Home", ""), ("Plans", "plans.html")])], priority="0.7")

# ------------------------------------------------------------------ about / why us
page("about.html", f"Why Autonomous Boat Service | How We Match Boaters & Shops",
  "Autonomous Boat Service is a Falmouth-based service-matching company for Cape Cod and the Islands. Your contact stays private until you're matched with one vetted local shop.",
  crumbs_bar([("Home", ""), ("Why us", "about.html")]) + page_head("Why us", "Boat service that runs itself for you", "We're a Falmouth-based service-matching company. We don't fix boats. We get your request to the local shop that should, quickly and privately.") +
  f'''<section class="block"><div class="wrap">{why_grid()}</div></section>
<section class="block alt"><div class="wrap"><h2>How it works</h2>{HOW}</div></section>
<section class="block"><div class="wrap narrow prose">
  <h2>What we are, and what we aren't</h2>
  <ul><li><strong>We are</strong> a matching service. We review every request and route it to approved independent shops that do that kind of work in that area.</li>
  <li><strong>We aren't</strong> a repair shop. We don't employ mechanics, set prices or guarantee anyone's work. Ask any shop about its experience, insurance and warranty before you hire it.</li>
  <li><strong>Shops are vetted before they get requests.</strong> They apply, we talk with them, and referral terms are agreed in writing first.</li>
  <li><strong>Your privacy comes first.</strong> Shops see an anonymous summary. Your name and number go to one matched shop, after you're matched.</li>
  <li><strong>Free for boaters.</strong> Partner shops may pay us a referral fee. That never adds a charge from us to your bill.</li></ul>
</div></section>''' + cta_band(), cur="about", ld=[crumbs_ld([("Home", ""), ("Why us", "about.html")])], priority="0.6")

# ------------------------------------------------------------------ parts
page("parts.html", f"Boat & Outboard Parts Finder on Cape Cod | {NAME}",
  "Need a boat or outboard part on Cape Cod or the Islands? Send the part name or number and your engine details. Partner shops and parts counters reply with availability and price.",
  crumbs_bar([("Home", ""), ("Parts", "parts.html")]) + page_head("Parts finder", "Find the part, without calling every counter", "Tell us the part and what it fits. We pass the request to partner shops and parts counters, and the one that can supply it contacts you.") +
  f'''<section class="block"><div class="wrap quote-wrap">
  <div>
    <h2>How parts requests work</h2>
    <ol class="steps-list"><li><strong>Describe the part:</strong> the name or number, plus the engine or boat make, model and year. A photo of the old part or its label helps a lot.</li>
    <li><strong>We ask partner shops:</strong> they see the part details and your general area, not your name or number.</li>
    <li><strong>One shop contacts you</strong> with availability, price and pickup or shipping. You decide.</li></ol>
    <p class="hint">We don't keep inventory or set prices. The supplying shop sells to you directly.</p>
    <p class="hint">Finding the number: outboard model and serial numbers are usually on a plate on the transom bracket or the engine's swivel bracket. Inboards and sterndrives have plates on the block and on the drive.</p>
  </div>
  <div>{parts_form()}</div>
</div></section>''', cur="parts", og="og-parts.jpg", scripts=["forms.js"], ld=[crumbs_ld([("Home", ""), ("Parts", "parts.html")]),
  {"@context": "https://schema.org", "@type": "Service", "name": "Boat and outboard parts finder", "provider": provider(), "url": SITE_URL + "parts.html", "areaServed": {"@type": "AdministrativeArea", "name": "Cape Cod"}}], priority="0.8")

# ------------------------------------------------------------------ partners
checks = "".join(f'<label class="check"><input type="checkbox" name="services" value="{k}"> <span>{v}</span></label>' for k, v in SERVICE_LABEL.items() if k != "other") + '<label class="check"><input type="checkbox" name="services" value="parts"> <span>Parts supply</span></label>'
TERR = [("Upper Cape", "Bourne, Falmouth, Woods Hole, Mashpee, Sandwich"), ("Mid Cape", "Barnstable, Hyannis, Osterville, Cotuit, Yarmouth, Dennis"),
        ("Lower & Outer Cape", "Harwich, Chatham, Brewster, Orleans, Eastham, Wellfleet, Truro, Provincetown"), ("Martha's Vineyard", "Vineyard Haven, Oak Bluffs, Edgartown, up-island"),
        ("Nantucket", "Nantucket Harbor, Madaket, Polpis"), ("South Shore & Buzzards Bay", "Plymouth to Hingham, Wareham, Marion, Mattapoisett")]
page("partners.html", f"Partner With Us: Boat Service Leads for Cape Cod Repair Shops | {NAME}",
  "Marine repair shops on Cape Cod, the Islands and the South Shore: get anonymous job requests for your services and towns, accept only the jobs you want, and get the customer's contact once matched.",
  crumbs_bar([("Home", ""), ("For shops", "partners.html")]) + page_head("For repair shops", "Jobs you want, in towns you cover", "We collect boat service and parts requests across Cape Cod, the Islands and the South Shore. Approved shops get an anonymous summary and choose which jobs to take.") + f'''
<section class="block"><div class="wrap">
  <h2>How leads are delivered</h2>
  <div class="grid steps steps4">
    <div class="card"><span class="num">1</span><h3>A request comes in</h3><p>The boater gives the boat, engine, job, location, urgency and photos, and agrees to our matching terms.</p></div>
    <div class="card"><span class="num">2</span><h3>You get a blind offer</h3><p>We send a private link (copied to you or emailed) with an anonymous summary: boat, engine, service or part, general area, urgency and photos. No name, phone, email or exact marina.</p></div>
    <div class="card"><span class="num">3</span><h3>Interested or Pass</h3><p>One tap either way. Add a note and an optional quote range. Links expire after 14 days.</p></div>
    <div class="card"><span class="num">4</span><h3>We release the contact</h3><p>When we match the job to you, the same link shows the customer's full details, to your shop only. Everyone else's offer is withdrawn.</p></div>
  </div>
</div></section>
<section class="block alt"><div class="wrap split">
  <div>
    <h2>Why shops like it</h2>
    <ul class="ticks">
      <li><strong>No shared leads.</strong> A customer's contact goes to one shop, never several.</li>
      <li><strong>Only your work.</strong> Tell us your services, engine brands and towns, and we only offer matching jobs.</li>
      <li><strong>Fill the slow weeks.</strong> Accept more in shoulder season, pass in July. It's up to you.</li>
      <li><strong>Better-qualified requests.</strong> Engine make, model and year, photos and urgency come in up front.</li>
      <li><strong>Your customer, your price.</strong> You quote, schedule and bill directly.</li>
    </ul>
  </div>
  <div class="card"><h3>Ways to work together</h3>
    <ul><li><strong>Pay per lead:</strong> a fee only for jobs released to you.</li><li><strong>Exclusive territory:</strong> first offer, or the only offer, for your service types in your towns.</li><li><strong>Own the platform:</strong> the site, the domain and the lead system are available to buy or license for a single company.</li></ul>
    <p class="hint">Terms are agreed in writing before any leads are sent. Ask us for details.</p></div>
</div></section>
<section class="block"><div class="wrap">
  <h2>Territories</h2>
  <div class="grid cards">{"".join(f'<div class="card"><h3>{t}</h3><p>{d}</p></div>' for t, d in TERR)}</div>
</div></section>
<section class="block alt"><div class="wrap quote-wrap">
  <div>
    <h2>Apply to receive requests</h2>
    <p>Applying is free and doesn't commit you to anything. We'll call to talk through your services, territory and terms. Only approved shops receive offers.</p>
    <p class="hint">Applying doesn't make you a listed or endorsed shop.</p>
  </div>
  <div>
  <form class="panel" id="partner-form" novalidate>
    <div class="field"><label for="p-shop">Shop name</label><input id="p-shop" name="shop_name" type="text" required maxlength="160" autocomplete="organization"></div>
    <div class="two">
      <div class="field"><label for="p-contact">Contact name</label><input id="p-contact" name="contact_name" type="text" required maxlength="120" autocomplete="name"></div>
      <div class="field"><label for="p-phone">Phone</label><input id="p-phone" name="phone" type="tel" required maxlength="30" autocomplete="tel"></div>
    </div>
    <div class="two">
      <div class="field"><label for="p-email">Email (offers are sent here)</label><input id="p-email" name="email" type="email" required maxlength="200" autocomplete="email"></div>
      <div class="field"><label for="p-web">Website <span class="opt">(optional)</span></label><input id="p-web" name="website" type="url" maxlength="300" placeholder="https://"></div>
    </div>
    <p class="label">Services you offer</p>
    <div class="checks">{checks}</div>
    <div class="field"><label for="p-area">Towns or territory</label><input id="p-area" name="service_area" type="text" required maxlength="300" placeholder="e.g. Falmouth, Bourne, Mashpee; mobile across the Upper Cape"></div>
    <div class="field"><label for="p-notes">Engine brands, capacity, anything else <span class="opt">(optional)</span></label><textarea id="p-notes" name="notes" maxlength="2000" placeholder="e.g. Yamaha and Mercury dealer, mobile van, indoor storage for 40 boats"></textarea></div>
    <div class="hp" aria-hidden="true"><label for="p-hp">Website URL</label><input id="p-hp" name="website_url" type="text" tabindex="-1" autocomplete="off"></div>
    <button class="btn" type="submit" style="width:100%">Apply to receive requests</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <div class="success" id="partner-success" hidden><h3>Thanks, application received.</h3><p>We'll reach out to talk about your services, territory and terms.</p></div>
  </div>
</div></section>
''', cur="partners", og="og-shops.jpg", scripts=["forms.js"], ld=[crumbs_ld([("Home", ""), ("For shops", "partners.html")])], priority="0.7")

# ------------------------------------------------------------------ account
page("account.html", f"My Account | {NAME}", "Sign in to track your boat service and parts requests.",
  crumbs_bar([("Home", ""), ("My account", "account.html")]) + '''<section class="block"><div class="wrap narrow">
  <h1>My account</h1>
  <p class="lead">Accounts are optional. You can always send a request as a guest. Sign in to see the status of requests you send while signed in.</p>
  <div id="account-area"><p class="hint">Loading…</p></div>
</div></section>''', cur="account", scripts=["account.js"], noindex=True)

# ------------------------------------------------------------------ shop offer page (tokened)
page("lead.html", f"Job offer | {NAME}", "Private job offer for a partner shop.",
  '''<section class="block"><div class="wrap narrow">
  <div id="lead-area"><p class="hint">Loading job…</p></div>
</div></section>''', scripts=["lead.js"], noindex=True, extra='<meta name="referrer" content="no-referrer">\n')

# ------------------------------------------------------------------ staff
page("staff.html", f"Staff | {NAME}", "Staff sign-in.", '''
<section class="block"><div class="wrap">
  <div id="auth" class="auth-box" hidden>
    <h1>Staff sign-in</h1>
    <p class="hint">For Autonomous Boat Service staff only.</p>
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
    <div class="toolbar" style="justify-content:space-between"><h1 style="margin:0">Staff</h1><span class="hint">Signed in as <span id="who"></span> · <button class="linklike" id="signout">Sign out</button></span></div>
    <div id="not-admin" class="success" hidden><h3>Not a staff account yet</h3><p>You're signed in, but this login hasn't been given staff access. The owner can add it with the admin SQL in docs/SETUP.md.</p></div>
    <div id="admin-area" hidden>
      <div class="stats" id="stats"></div>
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected="true" data-for="leads">Leads</button>
        <button role="tab" aria-selected="false" data-for="parts">Parts</button>
        <button role="tab" aria-selected="false" data-for="partners">Partner shops</button>
        <button role="tab" aria-selected="false" data-for="datareq">Privacy requests</button>
      </div>
      <div data-tab="leads">
        <div class="toolbar">
          <label for="f-status" class="label">Show</label>
          <select id="f-status"><option value="">All leads</option><option value="new">New</option><option value="offered">Offered to shops</option><option value="sent_to_shop">Assigned</option><option value="closed">Closed</option></select>
          <button class="btn sm ghost" id="reload">Refresh</button>
          <button class="btn sm ghost" id="csv-leads">Export CSV</button>
        </div>
        <div id="leads"></div>
      </div>
      <div data-tab="parts" hidden>
        <div class="toolbar"><button class="btn sm ghost" id="csv-parts">Export CSV</button></div>
        <div id="parts"></div>
      </div>
      <div data-tab="partners" hidden>
        <div class="toolbar"><button class="btn sm ghost" id="csv-partners">Export CSV</button></div>
        <p class="hint">Only shops marked <b>approved</b> can be offered leads. Their email is used for the "Email shop" button.</p>
        <div id="partners"></div>
      </div>
      <div data-tab="datareq" hidden><div id="datareq" style="margin-top:12px"></div></div>
    </div>
  </div>
</div></section>''', scripts=["staff.js"], noindex=True)

# ------------------------------------------------------------------ privacy / terms
page("privacy.html", f"Privacy Policy | {NAME}", f"How {NAME} collects, shares and deletes information from boat service and parts requests.", f'''
<section class="page-head"><div class="wrap"><h1>Privacy policy</h1><p class="lead">Last updated {TODAY_H}</p></div></section>
<section class="block"><div class="wrap narrow prose">
<p>{NAME} ("we") runs this website to connect boaters with independent marine repair shops and parts suppliers ("partner shops"). This policy explains what we collect and what we do with it.</p>
<h2>What we collect</h2>
<ul>
  <li><strong>Service and parts requests:</strong> your name, phone, optional email, boat and engine details, location or marina, the service or part you need, how urgent it is, your notes and any photos you upload.</li>
  <li><strong>Optional customer accounts:</strong> if you sign in, we store your email address so we can show you your own requests.</li>
  <li><strong>Partner shop applications:</strong> shop name, contact name, phone, email, website, services and service area.</li>
  <li><strong>Basic technical data:</strong> to stop spam, we keep a one-way, salted fingerprint of your IP address that changes daily. We don't use advertising trackers or sell data.</li>
</ul>
<h2>How we share it: two steps</h2>
<ol>
  <li><strong>Anonymous summary.</strong> To find a shop, we send approved partner shops a summary of your request: boat make, model, length and engine, the service or part, the town or general area, urgency and your photos. Any phone numbers or emails in your notes are removed. <strong>Your name, phone, email and exact marina are not included.</strong></li>
  <li><strong>One matched shop.</strong> Only after you're matched with a shop do we share your contact details, with <strong>that one shop only</strong>, so it can contact you about the job.</li>
</ol>
<p>You agree to this when you tick the consent box. We don't sell your information or share it for marketing by others. Our service providers store data for us: Supabase (database, sign-in and photo storage) and GitHub Pages (website hosting).</p>
<h2>How long we keep it</h2>
<p>We keep requests for as long as needed to arrange the work and handle follow-up, generally up to 24 months, then delete them. Shop offer links expire after 14 days. You can ask us to delete your information sooner.</p>
<h2 id="data-deletion">Delete my data</h2>
<p>To have your request and photos deleted, send the phone number or email you used below. We'll delete what we hold and confirm using that contact. A shop you were already matched with keeps its own records under its own policy, and we'll pass your request on to it when we can.</p>
<form class="panel" id="data-form" novalidate style="max-width:520px">
  <div class="field"><label for="d-contact">Phone or email you used</label><input id="d-contact" name="contact" type="text" required minlength="5" maxlength="200"></div>
  <div class="field"><label for="d-note">Anything else? <span class="opt">(optional)</span></label><input id="d-note" name="note" type="text" maxlength="1000"></div>
  <div class="hp" aria-hidden="true"><label for="d-hp">Website</label><input id="d-hp" name="website_url" type="text" tabindex="-1" autocomplete="off"></div>
  <button class="btn sea" type="submit">Request deletion</button>
  <p class="form-msg" role="status" aria-live="polite"></p>
</form>
<p data-email hidden>You can also email us: <a href="#"></a></p>
<h2>Children</h2><p>This site is for adults. We don't knowingly collect information from children under 13.</p>
<h2>Changes</h2><p>We'll post any changes on this page with a new date.</p>
</div></section>''', scripts=["forms.js"], priority="0.2")

page("terms.html", f"Terms of Use | {NAME}", f"Terms for using {NAME}, a boat repair and parts service-matching company.", f'''
<section class="page-head"><div class="wrap"><h1>Terms of use</h1><p class="lead">Last updated {TODAY_H}</p></div></section>
<section class="block"><div class="wrap narrow prose">
<h2>We're a service-matching company</h2>
<p>{NAME} connects boat owners with independent marine repair, service and parts businesses ("partner shops"). <strong>We don't perform repairs, sell parts, employ mechanics or supervise any work.</strong> Partner shops are independent businesses, not our employees or agents.</p>
<h2>No guarantee</h2>
<ul>
  <li>We don't guarantee that we can match every request, that a shop or part will be available, or how soon a shop will respond.</li>
  <li>We don't guarantee, warrant or endorse any shop's work, parts, prices, licensing, insurance or timing. Check those directly with the shop before you hire it.</li>
  <li>Any quote, agreement, payment, warranty, return or dispute is between you and the shop.</li>
</ul>
<h2>Fees</h2><p>Sending a request is free for boaters. Partner shops may pay us a referral fee. We don't add charges to any shop's bill.</p>
<h2>Maintenance plans</h2><p>Plans are arranged with, priced by and carried out by a partner shop. We help set them up and coordinate them.</p>
<h2>Emergencies</h2><p>This website isn't an emergency service. If anyone is in danger on the water, call 911 or the U.S. Coast Guard on VHF channel 16. For on-water towing, call a towing service directly. Submitting a form doesn't mean help is on the way.</p>
<h2>Your information and accounts</h2><p>Give accurate information and only submit requests for boats you own or are authorized to arrange service for. Accounts are optional and personal to you. By submitting a request, you agree to the two-step sharing described in our <a href="~/privacy.html">privacy policy</a>.</p>
<h2>Liability</h2><p>To the fullest extent allowed by law, {NAME} isn't liable for any loss, damage or injury arising from work or parts supplied by a partner shop, or from delays or failures to match a request. The site is provided "as is".</p>
<h2>Partner shops</h2><p>Applying to receive requests creates no obligation for either side. Referral terms are agreed separately in writing before any requests are sent. Offer links are confidential to the shop they were sent to.</p>
<h2>Governing law</h2><p>These terms are governed by the laws of the Commonwealth of Massachusetts.</p>
</div></section>''', priority="0.2")

page("404.html", f"Page not found | {NAME}", "Page not found.", '''
<section class="block"><div class="wrap narrow" style="text-align:center;padding:40px 20px">
  <p class="eyebrow">404</p>
  <h1>This page drifted off its mooring</h1>
  <p class="lead" style="margin:0 auto 20px">The page you're looking for isn't here. Need boat service? Start a request.</p>
  <p><a class="btn" href="~/quote.html">Get a quote</a> <a class="btn ghost" href="~/services/">Services</a> <a class="btn ghost" href="~/index.html">Home</a></p>
</div></section>''', noindex=True)

# ------------------------------------------------------------------ write
def out_name(p): return p + "index.html" if (p == "" or p.endswith("/")) else p
for p, html in PAGES.items():
    fn = out_name(p)
    if fn == "404.html":
        # GitHub Pages serves this for any missing path, so every local link is absolute.
        html = html.replace("~/", SITE_URL)
    else:
        html = html.replace("~/", "../" * fn.count("/") or "./")
    full = os.path.join(ROOT, fn); os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w").write(html)

open(os.path.join(ROOT, "sitemap.xml"), "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  "".join(f"  <url><loc>{SITE_URL}{p}</loc><lastmod>{TODAY}</lastmod><priority>{'1.0' if p == '' else pr}</priority></url>\n" for p, pr in SITEMAP) + "</urlset>\n")
open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /staff.html\nDisallow: /lead.html\nDisallow: /account.html\nSitemap: {SITE_URL}sitemap.xml\n")
open(os.path.join(ROOT, "site.webmanifest"), "w").write(json.dumps({"name": NAME, "short_name": "Boat Service", "start_url": "./", "scope": "./", "display": "standalone",
  "background_color": "#f7f3ea", "theme_color": "#0b2638", "icons": [{"src": "img/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "img/icon-512.png", "sizes": "512x512", "type": "image/png"}]}, indent=2) + "\n")
print(f"built {len(PAGES)} pages ({len(SITEMAP)} in sitemap); phone", "REAL " + TEL if PHONE_REAL else "placeholder (call buttons hidden, no telephone in JSON-LD)")
