/* Partner-shop job offer page: lead.html#t=TOKEN (token in the hash, so it never reaches server logs or referrers).
 * Shows the anonymous summary, lets the shop answer Interested / Pass, and shows the customer's contact
 * only after staff release the job to this shop. */
(function () {
  const ABS = window.ABS, esc = (s) => ABS.esc(s);
  const SVC = { engine_outboard: "Outboard engine", engine_inboard: "Inboard / sterndrive", winterizing: "Winterizing", shrink_wrap: "Shrink-wrap", commissioning: "Spring commissioning",
    hull_fiberglass: "Hull / fiberglass / gelcoat", electrical: "Electrical / electronics", bottom_paint: "Bottom paint", mobile_dockside: "Mobile / dockside", emergency_towing: "Emergency / haul-out",
    detailing: "Detailing", storage: "Storage", other: "Other" };
  const URG = { emergency: "Emergency", this_week: "This week", this_month: "This month", flexible: "Flexible" };
  const FUL = { pickup: "Customer will pick up", ship: "Ship to customer", either: "Pickup or ship" };
  const token = (new URLSearchParams(location.hash.replace(/^#/, "")).get("t") || "").toLowerCase();
  const area = () => document.getElementById("lead-area");
  const row = (k, v) => (v === null || v === undefined || v === "" ? "" : "<tr><th>" + esc(k) + "</th><td>" + esc(v) + "</td></tr>");
  const day = (s) => (s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

  function summaryTable(s) {
    if (s.kind === "part") return "<table class='kv'>" + row("Part", s.part_name) + row("Part number", s.part_number) + row("Fits", [s.make, s.model, s.model_year].filter(Boolean).join(" ")) +
      row("Serial", s.serial) + row("Delivery", FUL[s.fulfillment] || s.fulfillment) + row("General area", s.area) + row("Requested", day(s.requested_at)) + row("Notes", s.notes) + "</table>";
    return "<table class='kv'>" + row("Service", SVC[s.service] || s.service) + row("Urgency", URG[s.urgency] || s.urgency) + row("Boat", [s.boat_make, s.boat_model].filter(Boolean).join(" ")) +
      row("Length", s.boat_length_ft ? s.boat_length_ft + " ft" : "") + row("Engine", s.engine) + row("General area", s.area) + row("Requested", day(s.requested_at)) + row("Notes", s.notes) + "</table>";
  }
  function photos(s) {
    const u = s.photo_urls || [];
    return u.length ? '<div class="thumbs">' + u.map((x) => '<a href="' + esc(x) + '" target="_blank" rel="noopener noreferrer"><img src="' + esc(x) + '" alt="Photo from the customer" loading="lazy"></a>').join("") + "</div><p class='hint'>Photo links expire after an hour. Reload the page to refresh them.</p>" : "";
  }
  async function load() {
    if (!/^[0-9a-f]{48}$/.test(token)) { area().innerHTML = "<h1>Link not valid</h1><p>Please use the full link Autonomous Boat Service sent you.</p>"; return; }
    const r = await ABS.api("offer_view", {}, { token });
    const o = r && r.ok && r.offer;
    if (!o || !o.found) { area().innerHTML = "<h1>Link not valid</h1><p>This offer link wasn't found. It may have been replaced by a newer link.</p>"; return; }
    if (o.expired) { area().innerHTML = "<h1>This offer has expired</h1><p>Offer links last 14 days. Contact Autonomous Boat Service if you still want the job.</p>"; return; }
    if (o.withdrawn) { area().innerHTML = "<h1>This job is no longer available</h1><p>Thanks for looking. It's been matched elsewhere or withdrawn.</p>"; return; }
    const s = o.summary || {}, title = s.kind === "part" ? "Parts request" : "Service request";
    let h = '<p class="eyebrow">Private job offer for ' + esc(o.shop_name) + "</p><h1>" + esc(title) + (s.area ? " · " + esc(s.area) : "") + "</h1>";
    if (o.status === "released" && o.contact) {
      const c = o.contact;
      h += '<div class="callout ok"><h2>This job is yours</h2><p>Please contact the customer directly. These details were shared with your shop only.</p><table class="kv">' +
        row("Name", c.name) + "<tr><th>Phone</th><td><a href='tel:" + esc(String(c.phone || "").replace(/[^\d+]/g, "")) + "'>" + esc(c.phone) + "</a></td></tr>" +
        (c.email ? "<tr><th>Email</th><td><a href='mailto:" + esc(c.email) + "'>" + esc(c.email) + "</a></td></tr>" : "") + row("Location", c.location) + row("Customer's notes", c.details) + "</table></div>";
    } else {
      h += '<p class="lead">Here is an anonymous summary. The customer\'s name and contact are shared with one matched shop, after we match the job.</p>';
    }
    h += "<h2>Job details</h2>" + summaryTable(s) + photos(s);
    if (o.status !== "released") {
      const st = o.status === "interested" ? '<p class="callout">You said <b>Interested</b>' + (o.quote_low || o.quote_high ? " (range " + esc(o.quote_low || "?") + " to " + esc(o.quote_high || "?") + ")" : "") + ". We'll let you know if the job is released to you. You can update your answer below.</p>"
        : o.status === "passed" ? '<p class="callout">You passed on this job. Changed your mind? Answer again below.</p>' : "";
      h += st + `<form class="panel" id="respond" novalidate>
        <h2 style="margin-top:0">Want this job?</h2>
        <div class="field"><label for="r-note">Note for us <span class="opt">(optional)</span></label><textarea id="r-note" maxlength="1000" placeholder="e.g. Can look at it Thursday; dockside OK">${esc(o.shop_note || "")}</textarea></div>
        <div class="two"><div class="field"><label for="r-low">Rough quote range, low <span class="opt">(optional, USD)</span></label><input id="r-low" type="number" min="0" step="1" inputmode="numeric" value="${esc(o.quote_low || "")}"></div>
        <div class="field"><label for="r-high">High <span class="opt">(optional)</span></label><input id="r-high" type="number" min="0" step="1" inputmode="numeric" value="${esc(o.quote_high || "")}"></div></div>
        <div class="ctas"><button class="btn" type="button" data-r="interested">Interested</button> <button class="btn ghost" type="button" data-r="passed">Pass</button></div>
        <p class="form-msg" role="status" aria-live="polite"></p></form>`;
    }
    h += '<p class="hint" style="margin-top:18px">Link expires ' + esc(day(o.expires_at)) + ". Please keep it private. Anyone with this link can see the offer. Sent by Autonomous Boat Service.</p>";
    area().innerHTML = h;
    const f = document.getElementById("respond");
    if (f) f.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", async () => {
      const m = f.querySelector(".form-msg"); m.className = "form-msg"; m.textContent = "Sending…";
      const v = (id) => document.getElementById(id).value.trim();
      const res = await ABS.api("offer_respond", { response: b.dataset.r, note: v("r-note"), quote_low: v("r-low") || null, quote_high: v("r-high") || null }, { token });
      if (!res.ok) { m.className = "form-msg err"; m.textContent = res.error || "Something went wrong."; return; }
      load();
    }));
  }
  document.addEventListener("DOMContentLoaded", load);
  window.addEventListener("hashchange", () => location.reload());
})();
