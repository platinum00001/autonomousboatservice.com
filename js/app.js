/* Shared helpers: phone/call buttons, contact email, social links, API calls, supabase-js loader. */
(function () {
  const ABS = (window.ABS = window.ABS || {});
  const cfg = () => window.ABS_CONFIG || {};
  ABS.cfg = cfg;
  ABS.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // The phone is "real" only when it has 10+ digits that are not all zeros and no "coming soon".
  ABS.phoneDigits = function () {
    const p = String(cfg().PHONE || "");
    const d = p.replace(/\D/g, "");
    if (/coming soon|placeholder/i.test(p) || d.length < 10 || /^0+$/.test(d)) return null;
    return d.length === 10 ? "+1" + d : "+" + d;
  };
  function applyPhone() {
    const tel = ABS.phoneDigits();
    document.querySelectorAll("[data-call]").forEach((el) => {
      if (!tel) { el.hidden = true; return; }
      el.hidden = false;
      if (el.tagName === "A") el.href = "tel:" + tel;
      const label = el.querySelector("[data-phone-text]");
      if (label) label.textContent = cfg().PHONE;
    });
    document.querySelectorAll("[data-no-phone]").forEach((el) => { el.hidden = !!tel; });
  }
  function applyEmail() {
    const e = cfg().CONTACT_EMAIL;
    document.querySelectorAll("[data-email]").forEach((el) => {
      if (!e) { el.hidden = true; return; }
      el.hidden = false;
      const a = el.tagName === "A" ? el : el.querySelector("a");
      if (a) { a.href = "mailto:" + e; a.textContent = e; }
    });
  }
  function applySocial() {
    const s = cfg().SOCIAL || {}, box = document.getElementById("social");
    if (!box) return;
    const names = { facebook: "Facebook", instagram: "Instagram", x: "X" };
    const links = Object.keys(names).filter((k) => /^https:\/\//.test(s[k] || ""));
    if (!links.length) { box.hidden = true; return; }
    box.innerHTML = "<h3>Follow</h3><ul>" + links.map((k) => '<li><a rel="noopener" target="_blank" href="' + ABS.esc(s[k]) + '">' + names[k] + "</a></li>").join("") + "</ul>";
  }

  ABS.api = async function (action, data, extra, token) {
    const c = cfg();
    const res = await fetch(c.SUPABASE_URL + "/functions/v1/" + c.API_FUNCTION, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: c.SUPABASE_ANON_KEY, ...(token ? { authorization: "Bearer " + token } : {}) },
      body: JSON.stringify({ action, data: data || {}, ...(extra || {}) })
    }).catch(() => null);
    if (!res) return { ok: false, error: "We couldn't reach the server. Check your connection and try again." };
    const j = await res.json().catch(() => ({ ok: false, error: "Something went wrong. Please try again." }));
    return j;
  };

  let sbPromise = null;
  ABS.getSupabase = function () {
    if (sbPromise) return sbPromise;
    sbPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js";
      s.crossOrigin = "anonymous";
      s.onload = () => {
        const c = cfg();
        try {
          resolve(window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
          }));
        } catch (e) { console.warn(e); resolve(null); }
      };
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return sbPromise;
  };
  // Site root comes from <body data-root> ("./" or "../"), so links work at any depth.
  ABS.root = () => new URL((document.body && document.body.dataset.root) || "./", location.href).href;
  ABS.pageURL = (page) => new URL(page, ABS.root()).href.split("#")[0].split("?")[0];

  // Optional customer sign-in. Only load supabase-js when a saved session exists,
  // so guest pages stay light. Returns { token, email } or null.
  ABS.hasSavedSession = function () {
    try { const ref = new URL(cfg().SUPABASE_URL).hostname.split(".")[0]; return !!localStorage.getItem("sb-" + ref + "-auth-token"); } catch (e) { return false; }
  };
  ABS.currentUser = async function () {
    if (!ABS.hasSavedSession()) return null;
    const sb = await ABS.getSupabase(); if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    return s ? { token: s.access_token, email: (s.user && s.user.email) || "" } : null;
  };
  async function applySignedIn() {
    const u = await ABS.currentUser();
    document.querySelectorAll(".acct").forEach((a) => { if (u) a.textContent = "My account"; });
    document.querySelectorAll("[data-signed-in]").forEach((el) => { el.hidden = !u; const b = el.querySelector("[data-signed-email]"); if (b && u) b.textContent = u.email; });
    document.querySelectorAll("[data-account-link]").forEach((el) => { el.hidden = !u; });
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyPhone(); applyEmail(); applySocial(); applySignedIn();
    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  });
})();
