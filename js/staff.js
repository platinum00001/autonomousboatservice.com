/* Staff page: sign in (password or email link); leads and parts requests with the blind-offer flow
 * (anonymous offer links to approved shops, responses, "Release contact" to one shop); partner
 * applications; data requests; CSV export. All data comes through "boatservice-api",
 * which checks the login and lets only rows in boatservice.admins read anything. */
(function () {
  const ABS = window.ABS, esc = ABS.esc;
  const SERVICE = { engine_outboard: "Outboard engine", engine_inboard: "Inboard / sterndrive engine", winterizing: "Winterizing", shrink_wrap: "Shrink-wrap", commissioning: "Spring commissioning", hull_fiberglass: "Hull & fiberglass", electrical: "Electrical & electronics", bottom_paint: "Bottom paint", mobile_dockside: "Mobile / dockside", emergency_towing: "Emergency / haul-out referral", detailing: "Detailing", storage: "Storage", other: "Other", parts: "Parts supply" };
  const URG = { emergency: "Emergency", this_week: "This week", this_month: "This month", flexible: "Flexible" };
  const LEAD_STATUS = [["new", "New"], ["offered", "Offered to shops"], ["sent_to_shop", "Assigned to shop"], ["closed", "Closed"]];
  const STATUS_LABEL = { new: "new", offered: "offered", sent_to_shop: "assigned", closed: "closed" };
  const PARTNER_STATUS = ["new", "contacted", "approved", "declined"];
  let sb, token, openKey = null, data = { leads: [], parts: [], partners: [], offers: [], data_requests: [] };
  const $ = (id) => document.getElementById(id);
  const say = (el, t, bad) => { el.textContent = t; el.className = "form-msg " + (bad ? "err" : "ok"); };

  async function call(action, d) {
    const { data: s } = await sb.auth.getSession();
    token = s && s.session ? s.session.access_token : null;
    return ABS.api(action, d, null, token);
  }

  // ---------------------------------------------------------------- auth UI
  function showAuth() { $("auth").hidden = false; $("dash").hidden = true; }
  async function showDash() {
    const me = await call("me");
    if (!me.ok) { showAuth(); say($("auth-msg"), me.error || "Please sign in.", true); return; }
    $("auth").hidden = true; $("dash").hidden = false;
    $("who").textContent = me.email;
    if (!me.admin) { $("not-admin").hidden = false; $("admin-area").hidden = true; return; }
    $("not-admin").hidden = true; $("admin-area").hidden = false;
    await refresh();
  }

  async function refresh(keepOpen) {
    if (keepOpen) openKey = keepOpen;
    const [st, list] = await Promise.all([call("stats"), call("list", { status: $("f-status").value || null })]);
    if (st.ok) {
      const s = st.stats, b = s.leads_by_status || {}, p = s.partners_by_status || {};
      const items = [["New leads", b.new || 0], ["Offered to shops", b.offered || 0], ["Assigned", b.sent_to_shop || 0], ["Shops interested, awaiting you", s.offers_awaiting || 0], ["Open emergencies", s.emergencies_open], ["Open parts requests", s.parts_open || 0], ["Leads, last 7 days", s.leads_last_7d], ["Partner apps (new)", p.new || 0], ["Approved shops", p.approved || 0], ["Data requests open", s.data_requests_open]];
      $("stats").innerHTML = items.map((i) => '<div class="stat"><b>' + esc(i[1]) + "</b><span>" + esc(i[0]) + "</span></div>").join("");
    }
    if (!list.ok) { $("leads").textContent = list.error; return; }
    data = Object.assign({ leads: [], parts: [], partners: [], offers: [], data_requests: [] }, list);
    renderLeads(); renderPartners(); renderData();
  }

  // ---------------------------------------------------------------- blind offers
  // Shops first get an ANONYMOUS summary through a private link (lead.html#t=TOKEN). Contact details
  // are revealed to ONE shop only when staff click "Release contact". The raw token is shown once,
  // right after it's created; "Re-issue link" makes a fresh one (the old link stops working).
  // TODO(Resend): send offer links automatically with Resend from the edge function. For now staff copy the link or open an email.
  const links = {}; // offer_id -> raw link created in this session
  const TOWNS = ["Falmouth", "Woods Hole", "Mashpee", "Bourne", "Pocasset", "Cataumet", "Sandwich", "Barnstable", "Hyannis", "Osterville", "Cotuit", "Centerville", "Yarmouth", "Dennis", "Harwich", "Chatham", "Brewster", "Orleans", "Eastham", "Wellfleet", "Truro", "Provincetown", "Wareham", "Plymouth", "Edgartown", "Oak Bluffs", "Vineyard Haven", "Tisbury", "Nantucket", "Madaket"];
  const guessArea = (loc) => { const l = String(loc || "").toLowerCase(); const t = TOWNS.find((x) => l.includes(x.toLowerCase())); return t || ""; };
  const scrub = (t) => String(t || "").replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email removed]").replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone removed]");
  const OFFER_LABEL = { offered: "Sent", interested: "Interested", passed: "Passed", released: "Contact released", withdrawn: "Withdrawn" };
  const approved = () => data.partners.filter((p) => p.status === "approved");
  const offersFor = (kind, id) => data.offers.filter((o) => o.lead_kind === kind && (kind === "quote" ? o.quote_id : o.part_id) === id);
  function offerURL(token) { return ABS.pageURL("lead.html") + "#t=" + token; }
  function mailto(o, link, kind) {
    // No customer data in the email: the link shows the anonymous summary.
    const subj = "New " + (kind === "part" ? "parts request" : "boat job") + " near " + (o.summary && o.summary.area ? o.summary.area : "you") + " (Autonomous Boat Service)";
    const body = "Hi " + o.shop_name + ",\n\nWe have a " + (kind === "part" ? "parts request" : "boat service request") + " that may fit your shop. Details, without the customer's contact info, are here:\n\n" + link +
      "\n\nTap Interested or Pass on that page. If we match the job to you, the same link will show the customer's name and phone.\nThe link is private to your shop and expires in 14 days.\n\nThanks,\nAutonomous Boat Service";
    return "mailto:" + encodeURIComponent(o.shop_email || "") + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
  }
  function offersPanel(kind, r) {
    const list = offersFor(kind, r.id), done = r.status === "sent_to_shop" || r.status === "closed";
    const used = new Set(list.filter((o) => o.status !== "withdrawn").map((o) => o.partner_id));
    const shops = approved();
    let h = '<div class="offers"><h4>Shops offered</h4>';
    h += list.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Shop</th><th>Response</th><th>Note / range</th><th>Link</th><th></th></tr></thead><tbody>' + list.map((o) => {
      const l = links[o.id];
      return '<tr data-offer="' + esc(o.id) + '"><td>' + esc(o.shop_name) + '<div class="hint">' + (o.viewed_at ? "viewed " + esc(new Date(o.viewed_at).toLocaleDateString()) : "not viewed yet") + "</div></td>" +
        '<td><span class="pill o-' + esc(o.status) + '">' + esc(OFFER_LABEL[o.status] || o.status) + "</span>" + (o.status !== "released" && new Date(o.expires_at) < new Date() ? ' <span class="hint">expired</span>' : "") + "</td>" +
        "<td>" + esc(o.shop_note || "") + (o.quote_low || o.quote_high ? '<div class="hint">range ' + esc(o.quote_low || "?") + "–" + esc(o.quote_high || "?") + "</div>" : "") + "</td>" +
        "<td>" + (l ? '<input class="link-out" readonly value="' + esc(l) + '"> <button class="btn sm ghost" data-copylink>Copy</button> <a class="btn sm ghost" href="' + esc(mailto(o, l, kind)) + '">Email shop</a>'
          : o.status === "withdrawn" ? "" : '<button class="linklike" data-reissue>Re-issue link</button>') + "</td>" +
        "<td>" + (!done && (o.status === "offered" || o.status === "interested") ? '<button class="btn sm sea" data-release>Release contact to ' + esc(o.shop_name) + "</button> " : "") +
        (o.status === "offered" || o.status === "interested" || o.status === "passed" ? '<button class="linklike" data-withdraw>Withdraw</button>' : "") + "</td></tr>";
    }).join("") + "</tbody></table></div>" : '<p class="hint">Not offered to any shop yet.</p>';
    if (!done) {
      const avail = shops.filter((p) => !used.has(p.id));
      h += '<div class="offer-new"><h4>Offer to shops</h4>' + (avail.length ? '<div class="checks">' + avail.map((p) => '<label class="check"><input type="checkbox" data-pid="' + esc(p.id) + '"> <span>' + esc(p.shop_name) + ' <small class="hint">' + esc(p.service_area || "") + "</small></span></label>").join("") + "</div>" +
        '<div class="two"><div class="field"><label>General area shown to shops</label><input type="text" maxlength="120" data-area value="' + esc(r.area || guessArea(r.location)) + '" placeholder="Town only, e.g. Falmouth"></div>' +
        '<div class="field"><label>Notes shown to shops (phone and email are auto-removed)</label><textarea maxlength="1500" data-onotes>' + esc(scrub(r.details)) + "</textarea></div></div>" +
        '<p class="hint">Shops see: ' + (kind === "part" ? "part, number, make/model/year, serial, pickup or ship" : "service, urgency, boat make/model/length, engine") + ', the area above, these notes and photos. Never the name, phone, email or exact marina.</p>' +
        '<button class="btn sm" data-offer-send>Create offer links</button>'
        : '<p class="hint">' + (shops.length ? "Every approved shop already has an offer for this one." : 'No approved shops yet. Approve one on the "Partner shops" tab.') + "</p>") + "</div>";
    }
    return h + "</div>";
  }
  function hookOffers(d, kind, r, m) {
    d.querySelectorAll("[data-copylink]").forEach((b) => b.addEventListener("click", async () => {
      const inp = b.parentElement.querySelector(".link-out");
      try { await navigator.clipboard.writeText(inp.value); m.textContent = "Link copied."; } catch (e) { inp.select(); m.textContent = "Press Ctrl+C to copy."; }
    }));
    d.querySelectorAll("[data-offer]").forEach((tr) => {
      const id = tr.dataset.offer, o = data.offers.find((x) => x.id === id);
      const on = (sel, fn) => { const b = tr.querySelector(sel); if (b) b.addEventListener("click", fn); };
      on("[data-release]", async () => {
        if (!confirm("Release the customer's name, phone and email to " + o.shop_name + " only? All other offers for this request will be withdrawn.")) return;
        const res = await call("release_offer", { offer_id: id }); m.textContent = res.ok ? "Released to " + o.shop_name + ". Their link now shows the contact details." : res.error; if (res.ok) refresh(d.dataset.key);
      });
      on("[data-withdraw]", async () => { const res = await call("withdraw_offer", { offer_id: id }); m.textContent = res.ok ? "Withdrawn." : res.error; if (res.ok) refresh(d.dataset.key); });
      on("[data-reissue]", async () => {
        if (!confirm("Make a new link for " + o.shop_name + "? The old link will stop working.")) return;
        const res = await call("create_offers", { kind, id: r.id, partner_ids: [o.partner_id], area: (o.summary && o.summary.area) || r.area || guessArea(r.location), notes: (o.summary && o.summary.notes) || "" });
        if (res.ok) res.offers.forEach((x) => (links[x.offer_id] = offerURL(x.token)));
        m.textContent = res.ok ? "New link ready." : res.error; if (res.ok) refresh(d.dataset.key);
      });
    });
    const send = d.querySelector("[data-offer-send]");
    if (send) send.addEventListener("click", async () => {
      const ids = Array.from(d.querySelectorAll("[data-pid]:checked")).map((c) => c.dataset.pid);
      if (!ids.length) { m.textContent = "Tick at least one shop."; return; }
      const area = d.querySelector("[data-area]").value.trim();
      if (!area) { m.textContent = "Enter the general area (town) shops will see."; return; }
      send.disabled = true;
      const res = await call("create_offers", { kind, id: r.id, partner_ids: ids, area, notes: d.querySelector("[data-onotes]").value });
      send.disabled = false;
      if (res.ok) res.offers.forEach((x) => (links[x.offer_id] = offerURL(x.token)));
      m.textContent = res.ok ? res.offers.length + " link(s) created. Copy each link or email the shop now. Links are only shown once." : res.error;
      if (res.ok) refresh(d.dataset.key);
    });
  }

  // ---------------------------------------------------------------- leads + parts
  function leadText(r) {
    return [
      "Name: " + r.name, "Phone: " + r.phone + (r.email ? "   Email: " + r.email : ""),
      "Boat: " + [r.boat_make, r.boat_model, r.boat_length_ft ? r.boat_length_ft + " ft" : ""].filter(Boolean).join(" "),
      "Engine: " + (r.engine || "—"), "Location / marina: " + r.location,
      "Service: " + (SERVICE[r.service] || r.service) + "   Urgency: " + (URG[r.urgency] || r.urgency),
      "Details: " + (r.details || "—"), "Signed-in customer: " + (r.user_id ? "yes" : "no (guest)")
    ].join("\n");
  }
  function partText(r) {
    return [
      "Name: " + r.name, "Phone: " + r.phone + (r.email ? "   Email: " + r.email : ""),
      "Part: " + r.part_name + (r.part_number ? "  #" + r.part_number : ""), "Fits: " + [r.make, r.model, r.model_year].filter(Boolean).join(" ") + (r.serial ? "  serial " + r.serial : ""),
      "Pickup / ship: " + r.fulfillment + "   Location: " + r.location, "Notes: " + (r.details || "—"), "Signed-in customer: " + (r.user_id ? "yes" : "no (guest)")
    ].join("\n");
  }
  function renderRows(kind) {
    const isPart = kind === "part", box = $(isPart ? "parts" : "leads"), rows = isPart ? data.parts : data.leads;
    if (!rows.length) { box.innerHTML = '<p class="hint">' + (isPart ? "No parts requests yet." : "No leads yet.") + "</p>"; return; }
    box.innerHTML = rows.map((r, i) => {
      const key = kind + ":" + r.id, offs = offersFor(kind, r.id), interested = offs.filter((o) => o.status === "interested").length;
      return '<details class="lead-row" data-i="' + i + '" data-key="' + esc(key) + '"' + (openKey === key ? " open" : "") + '><summary><span class="pill ' + esc(r.status) + '">' + esc(STATUS_LABEL[r.status] || r.status) + "</span>" +
        (r.urgency === "emergency" ? '<span class="pill emergency">emergency</span>' : "") +
        "<strong>" + esc(r.name) + "</strong><span>" + esc(isPart ? r.part_name : SERVICE[r.service] || r.service) + '</span><span class="hint">' + esc(r.location) + " · " + esc(new Date(r.created_at).toLocaleString()) + "</span>" +
        (offs.length ? '<span class="hint">' + offs.length + " offer(s)" + (interested ? ", <b>" + interested + " interested</b>" : "") + "</span>" : "") +
        (r.assigned_shop ? '<span class="hint">→ ' + esc(r.assigned_shop) + "</span>" : "") + ((r.photo_paths || []).length ? '<span class="hint">' + r.photo_paths.length + " photo(s)</span>" : "") + "</summary>" +
        '<pre class="kv">' + esc(isPart ? partText(r) : leadText(r)) + '</pre><div class="photos" data-photos></div>' + offersPanel(kind, r) +
        '<div class="two"><div class="field"><label>Status</label><select data-status>' + LEAD_STATUS.map((s) => '<option value="' + s[0] + '"' + (s[0] === r.status ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select></div>" +
        '<div class="field"><label>Staff note (never shown to shops or customers)</label><input type="text" maxlength="2000" data-note value="' + esc(r.staff_note || "") + '"></div></div>' +
        '<p><button class="btn sm sea" data-save>Save</button> <a class="btn sm ghost" href="tel:' + esc(String(r.phone).replace(/[^\d+]/g, "")) + '">Call customer</a> <button class="linklike" data-del>Delete</button> <span class="hint" data-msg role="status"></span></p></details>';
    }).join("");
    box.querySelectorAll("details.lead-row").forEach((d) => {
      const r = rows[+d.dataset.i], m = d.querySelector("[data-msg]");
      const loadPhotos = async () => {
        const ph = d.querySelector("[data-photos]");
        if (!d.open || ph.dataset.loaded || !(r.photo_paths || []).length) return;
        ph.dataset.loaded = 1;
        const { data: urls } = await sb.storage.from(ABS.cfg().PHOTO_BUCKET).createSignedUrls(r.photo_paths, 3600);
        ph.innerHTML = (urls || []).map((u) => (u.signedUrl ? '<a target="_blank" rel="noopener" href="' + esc(u.signedUrl) + '"><img alt="Customer photo" src="' + esc(u.signedUrl) + '"></a>' : "")).join("");
      };
      d.addEventListener("toggle", () => { if (d.open) openKey = d.dataset.key; loadPhotos(); });
      if (d.open) loadPhotos();
      hookOffers(d, kind, r, m);
      d.querySelector("[data-save]").addEventListener("click", async () => {
        const res = await call(isPart ? "update_part" : "update_lead", { id: r.id, status: d.querySelector("[data-status]").value, staff_note: d.querySelector("[data-note]").value });
        m.textContent = res.ok ? "Saved." : res.error || "Not saved."; if (res.ok) refresh(d.dataset.key);
      });
      d.querySelector("[data-del]").addEventListener("click", async () => {
        if (!confirm("Delete this request, its offers and its photos permanently?")) return;
        const res = await call("delete", { kind: isPart ? "part" : "lead", id: r.id });
        if (res.ok && res.photo_paths && res.photo_paths.length) await sb.storage.from(ABS.cfg().PHOTO_BUCKET).remove(res.photo_paths);
        m.textContent = res.ok ? "Deleted." : res.error || "Not deleted."; if (res.ok) refresh();
      });
    });
  }
  function renderLeads() { renderRows("quote"); renderRows("part"); }

  function renderPartners() {
    const box = $("partners");
    if (!data.partners.length) { box.innerHTML = '<p class="hint">No partner applications yet.</p>'; return; }
    box.innerHTML = data.partners.map((p, i) =>
      '<details class="lead-row" data-i="' + i + '"><summary><span class="pill ' + esc(p.status) + '">' + esc(p.status) + "</span><strong>" + esc(p.shop_name) + "</strong><span>" + esc(p.contact_name) + '</span><span class="hint">' + esc(new Date(p.created_at).toLocaleDateString()) + "</span></summary>" +
      '<pre class="kv">' + esc("Phone: " + p.phone + "   Email: " + p.email + "\nWebsite: " + (p.website || "—") + "\nServices: " + ((p.services || []).map((s) => SERVICE[s] || s).join(", ") || "—") + "\nArea: " + p.service_area + "\nNotes: " + (p.notes || "—")) + "</pre>" +
      '<div class="two"><div class="field"><label>Status</label><select data-status>' + PARTNER_STATUS.map((s) => "<option" + (s === p.status ? " selected" : "") + ">" + s + "</option>").join("") + '</select></div><div class="field"><label>Staff note</label><input type="text" maxlength="2000" data-note value="' + esc(p.staff_note || "") + '"></div></div>' +
      '<p><button class="btn sm sea" data-save>Save</button> <button class="linklike" data-del>Delete</button> <span class="hint" data-msg></span></p></details>').join("");
    box.querySelectorAll("details.lead-row").forEach((d) => {
      const p = data.partners[+d.dataset.i], m = d.querySelector("[data-msg]");
      d.querySelector("[data-save]").addEventListener("click", async () => {
        const res = await call("update_partner", { id: p.id, status: d.querySelector("[data-status]").value, staff_note: d.querySelector("[data-note]").value });
        m.textContent = res.ok ? "Saved." : res.error || "Not saved."; if (res.ok) refresh();
      });
      d.querySelector("[data-del]").addEventListener("click", async () => {
        if (!confirm("Delete this application permanently?")) return;
        const res = await call("delete", { kind: "partner", id: p.id }); m.textContent = res.ok ? "Deleted." : res.error; if (res.ok) refresh();
      });
    });
  }

  function renderData() {
    const box = $("datareq");
    if (!data.data_requests.length) { box.innerHTML = '<p class="hint">No privacy requests.</p>'; return; }
    box.innerHTML = '<p class="hint">To honor a request: find leads and parts requests with that phone or email on the Leads and Parts tabs, delete them, then mark the request done.</p>' + data.data_requests.map((r, i) =>
      '<div class="lead-row" style="padding:12px 16px" data-i="' + i + '"><span class="pill ' + esc(r.status) + '">' + esc(r.status) + "</span> <strong>" + esc(r.contact) + "</strong> " + '<span class="hint">' + esc(new Date(r.created_at).toLocaleString()) + "</span>" + (r.note ? "<div>" + esc(r.note) + "</div>" : "") +
      ' <button class="btn sm ghost" data-done>' + (r.status === "done" ? "Reopen" : "Mark done") + "</button></div>").join("");
    box.querySelectorAll("[data-i]").forEach((el) => {
      const r = data.data_requests[+el.dataset.i];
      el.querySelector("[data-done]").addEventListener("click", async () => { const res = await call("update_data_request", { id: r.id, status: r.status === "done" ? "new" : "done" }); if (res.ok) refresh(); });
    });
  }

  function csv(rows, cols, name) {
    const text = [cols].concat(rows.map((r) => cols.map((c) => (Array.isArray(r[c]) ? r[c].join("; ") : r[c] == null ? "" : r[c]))))
      .map((l) => l.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    sb = await ABS.getSupabase();
    if (!sb) { say($("auth-msg"), "Couldn't load sign-in. Check your connection and reload.", true); return; }
    const url = ABS.pageURL("staff.html");

    $("pw-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
      if (error) return say($("auth-msg"), error.message === "Invalid login credentials" ? "Wrong email or password." : error.message, true);
      showDash();
    });
    $("link-btn").addEventListener("click", async () => {
      const email = $("email").value.trim();
      if (!email) return say($("auth-msg"), "Enter your email first.", true);
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: url, shouldCreateUser: false } });
      say($("auth-msg"), error ? (/not allowed|signups/i.test(error.message) ? "That email isn't a staff login yet." : error.message) : "Check your email for a sign-in link.", !!error);
    });
    $("reset-btn").addEventListener("click", async () => {
      const email = $("email").value.trim();
      if (!email) return say($("auth-msg"), "Enter your email first.", true);
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: url });
      say($("auth-msg"), error ? error.message : "If that's a staff login, a reset link is on its way.", !!error);
    });
    $("newpw-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.updateUser({ password: $("newpw").value });
      say($("newpw-msg"), error ? error.message : "Password updated.", !!error);
      if (!error) { $("newpw-form").hidden = true; showDash(); }
    });
    $("signout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
    $("f-status").addEventListener("change", refresh);
    $("reload").addEventListener("click", refresh);
    $("csv-leads").addEventListener("click", () => csv(data.leads, ["created_at", "status", "urgency", "service", "name", "phone", "email", "boat_make", "boat_model", "boat_length_ft", "engine", "location", "area", "details", "assigned_shop", "staff_note", "photo_paths", "id"], "boat-service-leads.csv"));
    $("csv-parts").addEventListener("click", () => csv(data.parts, ["created_at", "status", "part_name", "part_number", "make", "model", "model_year", "serial", "fulfillment", "location", "area", "name", "phone", "email", "details", "assigned_shop", "staff_note", "photo_paths", "id"], "boat-service-parts-requests.csv"));
    $("csv-partners").addEventListener("click", () => csv(data.partners, ["created_at", "status", "shop_name", "contact_name", "phone", "email", "website", "services", "service_area", "notes", "staff_note", "id"], "boat-service-partner-shops.csv"));
    document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
      document.querySelectorAll("[data-tab]").forEach((p) => (p.hidden = p.dataset.tab !== b.dataset.for));
    }));

    sb.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") { $("auth").hidden = true; $("dash").hidden = true; $("newpw-form").hidden = false; } });
    const { data: s } = await sb.auth.getSession();
    if (s && s.session && !/type=recovery/.test(location.hash)) showDash(); else if (!/type=recovery/.test(location.hash)) showAuth();
  });
})();
