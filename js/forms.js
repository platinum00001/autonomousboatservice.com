/* Quote, parts, partner application and data-request forms -> edge function "boatservice-api". */
(function () {
  const ABS = window.ABS;
  const started = Date.now();

  const uid = () => crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  function val(form, name) { const el = form.elements[name]; return el ? (el.value || "").trim() : ""; }
  function msg(form, text, ok) {
    const m = form.querySelector(".form-msg");
    m.textContent = text; m.className = "form-msg " + (ok ? "ok" : "err");
  }
  function busy(form, on) { const b = form.querySelector("button[type=submit]"); if (b) { b.disabled = on; b.dataset.label = b.dataset.label || b.textContent; b.textContent = on ? "Sending…" : b.dataset.label; } }

  // Shrink big phone photos before upload (JPEG, max 1800px). HEIC and others pass through.
  function shrink(file) {
    return new Promise((resolve) => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(file);
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 2.5e6) { URL.revokeObjectURL(url); return resolve(file); }
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => { URL.revokeObjectURL(url); resolve(b ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file); }, "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  async function uploadPhotos(files, id, prefix, max) {
    if (!files.length) return [];
    const sb = await ABS.getSupabase();
    if (!sb) throw new Error("Photo upload is unavailable right now. Please send the form without photos.");
    const paths = [];
    for (const [i, f0] of Array.from(files).slice(0, max || 6).entries()) {
      const f = await shrink(f0);
      if (f.size > 8 * 1024 * 1024) throw new Error("Each photo must be under 8 MB.");
      const safe = (f.name || "photo").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "").slice(-60) || "photo.jpg";
      const path = (prefix || "quotes") + "/" + id + "/" + (i + 1) + "-" + safe;
      const { error } = await sb.storage.from(ABS.cfg().PHOTO_BUCKET).upload(path, f, { contentType: f.type || "image/jpeg", upsert: false });
      if (error) throw new Error("A photo didn't upload (" + (error.message || "error") + "). Try a smaller photo, or send without photos.");
      paths.push(path);
    }
    return paths;
  }

  async function submit(form, action, data, onDone) {
    busy(form, true); msg(form, "", true);
    try {
      // Signed-in customers send their session so the request shows on their account. Guests send none.
      const u = (action === "quote" || action === "part") ? await ABS.currentUser().catch(() => null) : null;
      const r = await ABS.api(action, data, { website_url: val(form, "website_url"), t: started }, u && u.token);
      if (!r.ok) throw new Error(r.error || "Something went wrong. Please try again.");
      onDone();
    } catch (e) { msg(form, e.message || String(e), false); }
    busy(form, false);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const q = document.getElementById("quote-form");
    if (q) {
      // Preselect service from links like #quote?service=winterizing or service buttons.
      document.querySelectorAll("[data-pick-service]").forEach((a) => a.addEventListener("click", () => { q.elements.service.value = a.dataset.pickService; }));
      // Prefill from links: quote.html?service=winterizing&plan=seasonal&town=Falmouth
      const qs = new URLSearchParams(location.search);
      const svc = qs.get("service"), plan = qs.get("plan"), town = qs.get("town");
      if (svc && q.elements.service.querySelector('option[value="' + svc.replace(/[^a-z_]/g, "") + '"]')) q.elements.service.value = svc;
      if (plan) { const names = { seasonal: "Seasonal Care", engine: "Engine Care", dockside: "Dockside Care", storage: "Haul-Out & Storage", fleet: "Fleet / multi-boat" };
        if (names[plan]) q.elements.details.value = "Interested in the " + names[plan] + " plan. Please send pricing.\n"; }
      if (town && !q.elements.location.value) q.elements.location.value = town.slice(0, 80);
      q.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        if (!q.reportValidity()) return;
        if (!q.elements.consent_share.checked) return msg(q, "Please agree to share your request with partner shops so we can match you.", false);
        const id = uid();
        let photo_paths = [];
        const files = q.elements.photos ? q.elements.photos.files : [];
        if (files && files.length) {
          busy(q, true); msg(q, "Uploading photos…", true);
          try { photo_paths = await uploadPhotos(files, id); } catch (e) { busy(q, false); return msg(q, e.message, false); }
        }
        const data = { id, photo_paths, consent_share: true, source_page: location.pathname.slice(0, 200) };
        ["name", "phone", "email", "boat_make", "boat_model", "boat_length_ft", "engine", "location", "service", "urgency", "details"].forEach((k) => (data[k] = val(q, k)));
        await submit(q, "quote", data, () => {
          q.hidden = true;
          const ok = document.getElementById("quote-success");
          ok.hidden = false;
          ok.querySelector("[data-urgent]").hidden = data.urgency !== "emergency";
          const al = ok.querySelector("[data-account-link]"); if (al) al.hidden = !ABS.hasSavedSession();
          ok.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    }

    const pf = document.getElementById("parts-form");
    if (pf) pf.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!pf.reportValidity()) return;
      if (!pf.elements.consent_share.checked) return msg(pf, "Please agree to the sharing terms so we can ask partner shops.", false);
      const id = uid();
      let photo_paths = [];
      const files = pf.elements.photos ? pf.elements.photos.files : [];
      if (files && files.length) {
        busy(pf, true); msg(pf, "Uploading photos…", true);
        try { photo_paths = await uploadPhotos(files, id, "parts", 4); } catch (e) { busy(pf, false); return msg(pf, e.message, false); }
      }
      const data = { id, photo_paths, consent_share: true, source_page: location.pathname.slice(0, 200) };
      ["name", "phone", "email", "part_name", "part_number", "make", "model", "model_year", "serial", "fulfillment", "location", "details"].forEach((k) => (data[k] = val(pf, k)));
      await submit(pf, "part", data, () => {
        pf.hidden = true; const ok = document.getElementById("parts-success"); ok.hidden = false;
        ok.querySelector("[data-account-link]").hidden = !ABS.hasSavedSession();
        ok.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    const p = document.getElementById("partner-form");
    if (p) p.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!p.reportValidity()) return;
      const services = Array.from(p.querySelectorAll("input[name=services]:checked")).map((c) => c.value);
      const data = { services };
      ["shop_name", "contact_name", "phone", "email", "website", "service_area", "notes"].forEach((k) => (data[k] = val(p, k)));
      await submit(p, "partner", data, () => { p.hidden = true; document.getElementById("partner-success").hidden = false; });
    });

    const d = document.getElementById("data-form");
    if (d) d.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!d.reportValidity()) return;
      await submit(d, "data_request", { contact: val(d, "contact"), note: val(d, "note") }, () => { d.reset(); msg(d, "Got it. We'll delete your information and confirm using the contact you gave.", true); });
    });
  });
})();
