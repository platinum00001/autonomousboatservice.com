/* Staff page: sign in (password or email link), lead list with status / assigned shop / notes,
 * partner applications, data requests, CSV export. All data comes through "boatservice-api",
 * which checks the login and lets only rows in boatservice.admins read anything. */
(function () {
  const ABS = window.ABS, esc = ABS.esc;
  const SERVICE = { engine_outboard: "Outboard engine", engine_inboard: "Inboard / sterndrive engine", winterizing: "Winterizing", shrink_wrap: "Shrink-wrap", hull_fiberglass: "Hull & fiberglass", electrical: "Electrical & electronics", bottom_paint: "Bottom paint", mobile_dockside: "Mobile / dockside", emergency_towing: "Emergency / towing referral", other: "Other" };
  const URG = { emergency: "Emergency", this_week: "This week", this_month: "This month", flexible: "Flexible" };
  const LEAD_STATUS = [["new", "New"], ["sent_to_shop", "Sent to shop"], ["closed", "Closed"]];
  const PARTNER_STATUS = ["new", "contacted", "approved", "declined"];
  let sb, token, data = { leads: [], partners: [], data_requests: [] };
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

  async function refresh() {
    const [st, list] = await Promise.all([call("stats"), call("list", { status: $("f-status").value || null })]);
    if (st.ok) {
      const s = st.stats, b = s.leads_by_status || {}, p = s.partners_by_status || {};
      const items = [["New leads", b.new || 0], ["Sent to shop", b.sent_to_shop || 0], ["Closed", b.closed || 0], ["Open emergencies", s.emergencies_open], ["Leads, last 7 days", s.leads_last_7d], ["Partner apps (new)", p.new || 0], ["Approved shops", p.approved || 0], ["Data requests open", s.data_requests_open]];
      $("stats").innerHTML = items.map((i) => '<div class="stat"><b>' + esc(i[1]) + "</b><span>" + esc(i[0]) + "</span></div>").join("");
    }
    if (!list.ok) { $("leads").textContent = list.error; return; }
    data = list;
    renderLeads(); renderPartners(); renderData();
  }

  function shopOptions() {
    return '<datalist id="shops">' + data.partners.filter((p) => p.status === "approved").map((p) => '<option value="' + esc(p.shop_name) + '">').join("") + "</datalist>";
  }
  function leadText(r) {
    return [
      "Phone: " + r.phone + (r.email ? "   Email: " + r.email : ""),
      "Boat: " + [r.boat_make, r.boat_model, r.boat_length_ft ? r.boat_length_ft + " ft" : ""].filter(Boolean).join(" ") ,
      "Engine: " + (r.engine || "—"),
      "Location / marina: " + r.location,
      "Service: " + (SERVICE[r.service] || r.service) + "   Urgency: " + (URG[r.urgency] || r.urgency),
      "Details: " + (r.details || "—"),
      "Consent to share with partner shops: yes"
    ].join("\n");
  }

  function renderLeads() {
    const box = $("leads");
    if (!data.leads.length) { box.innerHTML = '<p class="hint">No leads yet.</p>'; return; }
    box.innerHTML = shopOptions() + data.leads.map((r, i) =>
      '<details class="lead-row" data-i="' + i + '"><summary><span class="pill ' + esc(r.status) + '">' + esc(r.status.replace(/_/g, " ")) + "</span>" +
      (r.urgency === "emergency" ? '<span class="pill emergency">emergency</span>' : "") +
      "<strong>" + esc(r.name) + "</strong><span>" + esc(SERVICE[r.service] || r.service) + "</span><span class=hint>" + esc(r.location) + " · " + esc(new Date(r.created_at).toLocaleString()) + "</span>" +
      (r.assigned_shop ? '<span class="hint">→ ' + esc(r.assigned_shop) + "</span>" : "") + ((r.photo_paths || []).length ? '<span class="hint">' + r.photo_paths.length + " photo(s)</span>" : "") + "</summary>" +
      '<pre class="kv">' + esc(leadText(r)) + '</pre><div class="photos" data-photos></div>' +
      '<div class="three"><div class="field"><label>Status</label><select data-status>' + LEAD_STATUS.map((s) => '<option value="' + s[0] + '"' + (s[0] === r.status ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select></div>" +
      '<div class="field"><label>Assigned shop</label><input type="text" list="shops" maxlength="160" data-shop value="' + esc(r.assigned_shop || "") + '"></div>' +
      '<div class="field"><label>Staff note</label><input type="text" maxlength="2000" data-note value="' + esc(r.staff_note || "") + '"></div></div>' +
      '<p><button class="btn sm sea" data-save>Save</button> <a class="btn sm ghost" href="tel:' + esc(r.phone.replace(/[^\d+]/g, "")) + '">Call boater</a> <button class="btn sm ghost" data-copy>Copy for shop</button> <button class="linklike" data-del>Delete</button> <span class="hint" data-msg></span></p></details>').join("");
    box.querySelectorAll("details.lead-row").forEach((d) => {
      const r = data.leads[+d.dataset.i], m = d.querySelector("[data-msg]");
      d.addEventListener("toggle", async () => {
        const ph = d.querySelector("[data-photos]");
        if (!d.open || ph.dataset.loaded || !(r.photo_paths || []).length) return;
        ph.dataset.loaded = 1;
        const { data: urls } = await sb.storage.from(ABS.cfg().PHOTO_BUCKET).createSignedUrls(r.photo_paths, 3600);
        ph.innerHTML = (urls || []).map((u) => (u.signedUrl ? '<a target="_blank" rel="noopener" href="' + esc(u.signedUrl) + '"><img alt="Boat photo" src="' + esc(u.signedUrl) + '"></a>' : "")).join("");
      });
      d.querySelector("[data-save]").addEventListener("click", async () => {
        const res = await call("update_lead", { id: r.id, status: d.querySelector("[data-status]").value, assigned_shop: d.querySelector("[data-shop]").value, staff_note: d.querySelector("[data-note]").value });
        m.textContent = res.ok ? "Saved." : res.error || "Not saved."; if (res.ok) refresh();
      });
      d.querySelector("[data-copy]").addEventListener("click", async () => {
        const t = "Boat service lead (via Autonomous Boat Service)\nName: " + r.name + "\n" + leadText(r);
        try { await navigator.clipboard.writeText(t); m.textContent = "Copied."; } catch (e) { m.textContent = "Copy not allowed in this browser."; }
      });
      d.querySelector("[data-del]").addEventListener("click", async () => {
        if (!confirm("Delete this lead and its photos permanently?")) return;
        const res = await call("delete", { kind: "lead", id: r.id });
        if (res.ok && res.photo_paths && res.photo_paths.length) await sb.storage.from(ABS.cfg().PHOTO_BUCKET).remove(res.photo_paths);
        m.textContent = res.ok ? "Deleted." : res.error || "Not deleted."; if (res.ok) refresh();
      });
    });
  }

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
    box.innerHTML = '<p class="hint">To honor a request: find leads with that phone or email on the Leads tab, delete them, then mark the request done.</p>' + data.data_requests.map((r, i) =>
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
    $("csv-leads").addEventListener("click", () => csv(data.leads, ["created_at", "status", "urgency", "service", "name", "phone", "email", "boat_make", "boat_model", "boat_length_ft", "engine", "location", "details", "assigned_shop", "staff_note", "photo_paths", "id"], "boat-service-leads.csv"));
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
