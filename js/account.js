/* Optional customer accounts: email magic link, plus Google / Facebook shown as "Soon" until the owner
 * turns them on in Supabase Auth. Lists the signed-in customer's own requests via my_requests()
 * (customer-safe fields only). Guests never need an account. */
(function () {
  const ABS = window.ABS, esc = (s) => ABS.esc(s);
  const ACCOUNT_URL = () => ABS.pageURL("account.html");
  const PROVIDERS = { google: "Google", facebook: "Facebook" };
  const SVC = { engine_outboard: "Outboard engine", engine_inboard: "Inboard / sterndrive", winterizing: "Winterizing", shrink_wrap: "Shrink-wrap", commissioning: "Spring commissioning",
    hull_fiberglass: "Hull / fiberglass", electrical: "Electrical", bottom_paint: "Bottom paint", mobile_dockside: "Mobile / dockside", emergency_towing: "Emergency / haul-out", detailing: "Detailing", storage: "Storage", other: "Other" };
  const STATUS = { new: "Received", offered: "Finding a shop", sent_to_shop: "Matched", closed: "Closed" };
  let settings = null;
  const authSettings = () => settings || (settings = fetch(ABS.cfg().SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: ABS.cfg().SUPABASE_ANON_KEY } }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  const area = () => document.getElementById("account-area");
  const day = (s) => new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function urlAuthError() {
    const h = new URLSearchParams(location.hash.replace(/^#/, "")), q = new URLSearchParams(location.search);
    const d = h.get("error_description") || q.get("error_description");
    if (!d) return "";
    history.replaceState(null, "", location.pathname);
    if (/provider is not enabled|Unsupported provider/i.test(d)) return "That sign-in option isn't switched on yet. Please use the email link.";
    if (/expired|invalid/i.test(d)) return "That sign-in link has expired or was already used. Please request a new one.";
    return d.replace(/\+/g, " ");
  }
  const gIcon = '<svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  const fIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>';

  function signInView(sb, notice) {
    area().innerHTML = (notice ? '<p class="callout" role="alert">' + esc(notice) + "</p>" : "") +
      '<div class="panel"><h2 style="margin-top:0">Sign in or create a free account</h2>' +
      '<div class="oauth-row">' + Object.keys(PROVIDERS).map((p) => '<button type="button" class="btn oauth" data-provider="' + p + '">' + (p === "google" ? gIcon : fIcon) + "<span>Continue with " + PROVIDERS[p] + '</span><span class="soon" hidden>Soon</span></button>').join("") + "</div>" +
      '<p id="oauth-msg" class="hint" role="status"></p><div class="divider"><span>or use your email</span></div>' +
      '<form id="magic"><div class="field"><label for="ml-email">Email</label><input id="ml-email" type="email" autocomplete="email" required></div>' +
      '<button class="btn" type="submit">Email me a sign-in link</button> <span id="ml-msg" class="hint" role="status"></span>' +
      '<p class="hint">No password needed. New here? The link creates your account. We don\'t sign you up for marketing emails.</p></form></div>' +
      '<p class="hint" style="margin-top:14px">Requests you send as a guest aren\'t linked to an account. To track a request, sign in first, then send it.</p>';
    authSettings().then((st) => { if (st && st.external) area().querySelectorAll("[data-provider]").forEach((b) => { if (!st.external[b.dataset.provider]) b.querySelector(".soon").hidden = false; }); });
    area().querySelectorAll("[data-provider]").forEach((b) => b.addEventListener("click", async () => {
      const p = b.dataset.provider, m = document.getElementById("oauth-msg"), st = await authSettings();
      if (st && st.external && !st.external[p]) { m.textContent = PROVIDERS[p] + " sign-in is coming soon. For now, please use the email link."; return; }
      m.textContent = "Opening " + PROVIDERS[p] + "…";
      const { error } = await sb.auth.signInWithOAuth({ provider: p, options: { redirectTo: ACCOUNT_URL() } });
      if (error) m.textContent = /not enabled|Unsupported provider/i.test(error.message) ? PROVIDERS[p] + " sign-in is coming soon." : error.message;
    }));
    document.getElementById("magic").addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = document.getElementById("ml-msg"); m.textContent = "Sending…";
      const { error } = await sb.auth.signInWithOtp({ email: document.getElementById("ml-email").value.trim(), options: { emailRedirectTo: ACCOUNT_URL(), shouldCreateUser: true } });
      m.textContent = error ? (/rate|too many/i.test(error.message) ? "Too many tries. Please wait a few minutes." : error.message) : "Check your email for a sign-in link (check spam too).";
    });
  }

  async function dashboard(sb, session) {
    area().innerHTML = '<p>Signed in as <strong>' + esc(session.user.email) + '</strong>. <button class="btn sm ghost" id="so">Sign out</button></p><div id="mine"><p class="hint">Loading your requests…</p></div>' +
      '<div class="ctas" style="margin-top:18px"><a class="btn" href="quote.html">New service request</a> <a class="btn ghost" href="parts.html">Find a part</a></div>' +
      '<p class="hint" style="margin-top:18px">To delete your requests, use <a href="privacy.html#data-deletion">Delete my data</a>.</p>';
    document.getElementById("so").addEventListener("click", async () => { await sb.auth.signOut(); render(); });
    const r = await ABS.api("my_requests", {}, null, session.access_token);
    const box = document.getElementById("mine");
    if (!r.ok) { box.innerHTML = '<p class="form-msg err">' + esc(r.error || "Couldn't load your requests.") + "</p>"; return; }
    const st = (x) => '<span class="pill s-' + esc(x.status) + '">' + esc(STATUS[x.status] || x.status) + "</span>" + (x.shop ? " · " + esc(x.shop) + " will contact you" : "");
    const q = r.quotes || [], p = r.parts || [];
    box.innerHTML = "<h2>Service requests</h2>" + (q.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Service</th><th>Boat</th><th>Where</th><th>Status</th></tr></thead><tbody>' +
      q.map((x) => "<tr><td>" + day(x.created_at) + "</td><td>" + esc(SVC[x.service] || x.service) + "</td><td>" + esc(x.boat || "") + "</td><td>" + esc(x.location || "") + "</td><td>" + st(x) + "</td></tr>").join("") + "</tbody></table></div>" : '<p class="hint">None yet.</p>') +
      "<h2>Parts requests</h2>" + (p.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Part</th><th>Fits</th><th>Delivery</th><th>Status</th></tr></thead><tbody>' +
      p.map((x) => "<tr><td>" + day(x.created_at) + "</td><td>" + esc(x.part_name) + (x.part_number ? " (" + esc(x.part_number) + ")" : "") + "</td><td>" + esc([x.make, x.model].filter(Boolean).join(" ")) + "</td><td>" + esc(x.fulfillment) + "</td><td>" + st(x) + "</td></tr>").join("") + "</tbody></table></div>" : '<p class="hint">None yet.</p>');
  }

  async function render(notice) {
    const sb = await ABS.getSupabase();
    if (!sb) { area().innerHTML = '<p class="form-msg err">Sign-in is unavailable right now. You can still send requests as a guest.</p>'; return; }
    const { data } = await sb.auth.getSession();
    if (data && data.session) dashboard(sb, data.session); else signInView(sb, notice);
  }
  document.addEventListener("DOMContentLoaded", async () => {
    const err = urlAuthError();
    const sb = await ABS.getSupabase();
    if (sb) sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") render(); });
    render(err);
  });
})();
