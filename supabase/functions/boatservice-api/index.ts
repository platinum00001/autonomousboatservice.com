// Autonomous Boat Service — public API (Supabase Edge Function "boatservice-api", verify_jwt = false).
// The site stores everything in its own schema "boatservice". Every query runs under Row Level Security:
//   * public actions run as "anon" (insert-only policies + token-checked SECURITY DEFINER functions),
//   * signed-in customers run as "authenticated" with their own id in request.jwt.claims,
//   * staff actions verify the login, then the database itself checks boatservice.admins.
// The service-role key is used for ONE thing only: signing short-lived photo URLs for a shop that
// holds a valid offer token (paths come from the token-checked database function, never the caller).
// No email or SMS is sent from here. TODO(Resend): optional automatic offer emails to shops.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 20 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SALT = Deno.env.get("BS_HASH_SALT") ?? "boatservice-v1";
const BUCKET = "boatservice-photos";

const ALLOWED = [/^https:\/\/platinum00001\.github\.io$/, /^https:\/\/(www\.)?autonomousboatservice\.com$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.some((r) => r.test(o)) ? o : "https://platinum00001.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const SERVICES = ["engine_outboard", "engine_inboard", "winterizing", "shrink_wrap", "commissioning", "hull_fiberglass", "electrical", "bottom_paint", "mobile_dockside", "emergency_towing", "detailing", "storage", "other"];
const URGENCY = ["emergency", "this_week", "this_month", "flexible"];
const LEAD_STATUS = ["new", "offered", "sent_to_shop", "closed"];
const PARTNER_STATUS = ["new", "contacted", "approved", "declined"];
const FULFILL = ["pickup", "ship", "either"];

class UserError extends Error {}
const str = (v: unknown, max: number) => {
  if (v == null) return null;
  const s = String(v).trim().slice(0, max);
  return s === "" ? null : s;
};
const num = (v: unknown) => (v === "" || v == null ? null : Number(v));
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tokenRe = /^[0-9a-f]{48}$/;

async function clientHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SALT + "|" + day + "|" + ip));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Run fn inside a transaction as the given role/claims, exactly like PostgREST does.
function asRole<T>(role: "anon" | "authenticated", claims: Record<string, unknown>, fn: (tx: postgres.TransactionSql) => Promise<T>) {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ ...claims, role })}, true)`;
    await tx.unsafe(role === "anon" ? "set local role anon" : "set local role authenticated");
    return await fn(tx);
  });
}

async function userFromToken(req: Request, required: boolean) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token.startsWith("sb_")) { if (required) throw new UserError("Please sign in."); return null; }
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON_KEY, authorization: "Bearer " + token } });
  if (!r.ok) { if (required) throw new UserError("Please sign in again."); return null; }
  const u = await r.json();
  if (!u?.id) { if (required) throw new UserError("Please sign in again."); return null; }
  return { sub: u.id as string, email: u.email as string };
}
const claimsFor = (u: { sub: string; email: string }) => ({ sub: u.sub, email: u.email, aud: "authenticated" });

// Signed URLs for photos that the database already authorised for this token.
async function signPhotos(paths: string[]) {
  if (!SERVICE_KEY || !paths?.length) return [];
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SERVICE_KEY, authorization: "Bearer " + SERVICE_KEY },
    body: JSON.stringify({ expiresIn: 3600, paths: paths.slice(0, 6) }),
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (Array.isArray(j) ? j : []).filter((x) => x.signedURL).map((x) => SUPABASE_URL + "/storage/v1" + x.signedURL);
}

async function handle(req: Request, body: Record<string, any>) {
  const action = String(body.action ?? "");
  const d = (body.data ?? {}) as Record<string, any>;

  // ---------------- shop actions: token only, no login
  if (action === "offer_view" || action === "offer_respond") {
    const t = String(body.token ?? "");
    if (!tokenRe.test(t)) return { ok: true, offer: { found: false } };
    if (action === "offer_view") {
      const [{ v }] = await asRole("anon", {}, (tx) => tx`select boatservice.offer_view(${t}) as v`);
      if (v?.summary?.photos) { v.summary.photo_urls = await signPhotos(v.summary.photos); delete v.summary.photos; }
      return { ok: true, offer: v };
    }
    const low = num(d.quote_low), high = num(d.quote_high);
    if ((low != null && (!isFinite(low) || low < 0 || low > 1e7)) || (high != null && (!isFinite(high) || high < 0 || high > 1e7))) throw new UserError("Quote range should be numbers.");
    const [{ v }] = await asRole("anon", {}, (tx) => tx`select boatservice.offer_respond(${t}, ${String(d.response)}, ${str(d.note, 1000)}, ${low}, ${high}) as v`);
    return { ok: true, result: v };
  }

  // ---------------- public forms (anon, or the signed-in customer so the request shows on their account)
  if (["quote", "part", "partner", "data_request"].includes(action)) {
    if (str(body.website_url, 200)) return { ok: true }; // honeypot filled: pretend success, store nothing
    if (typeof body.t === "number" && Date.now() - body.t < 2500) return { ok: true }; // too fast for a human
    const hash = await clientHash(req);
    const who = action === "quote" || action === "part" ? await userFromToken(req, false) : null;
    const run = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) => who ? asRole("authenticated", claimsFor(who), fn) : asRole("anon", {}, fn);
    if (action === "quote") {
      const id = uuidRe.test(String(d.id ?? "")) ? String(d.id) : crypto.randomUUID();
      const service = SERVICES.includes(d.service) ? d.service : null;
      if (!str(d.name, 120) || !str(d.phone, 30) || !str(d.location, 160) || !service) throw new UserError("Please fill in your name, phone, location and the service you need.");
      if (d.consent_share !== true) throw new UserError("Please tick the consent box so we can match you with a shop.");
      const len = num(d.boat_length_ft);
      if (len != null && (!isFinite(len) || len < 5 || len > 300)) throw new UserError("Boat length should be in feet, between 5 and 300.");
      const photos = Array.isArray(d.photo_paths) ? d.photo_paths.slice(0, 6).map(String) : [];
      await run((tx) => tx`insert into boatservice.quote_requests
        (id, name, phone, email, boat_make, boat_model, boat_length_ft, engine, location, service, urgency, details, photo_paths, consent_share, source_page, client_hash)
        values (${id}, ${str(d.name, 120)}, ${str(d.phone, 30)}, ${str(d.email, 200)}, ${str(d.boat_make, 80)}, ${str(d.boat_model, 80)}, ${len},
          ${str(d.engine, 160)}, ${str(d.location, 160)}, ${service}, ${URGENCY.includes(d.urgency) ? d.urgency : "flexible"}, ${str(d.details, 3000)},
          ${photos}, true, ${str(d.source_page, 200)}, ${hash})`);
      return { ok: true, id, linked_to_account: !!who };
    }
    if (action === "part") {
      const id = uuidRe.test(String(d.id ?? "")) ? String(d.id) : crypto.randomUUID();
      if (!str(d.name, 120) || !str(d.phone, 30) || !str(d.part_name, 160) || !str(d.make, 80) || !str(d.location, 160)) throw new UserError("Please fill in your name, phone, the part, the make and your town or ZIP.");
      if (d.consent_share !== true) throw new UserError("Please tick the consent box so we can match you with a shop.");
      const yr = num(d.model_year);
      if (yr != null && (!Number.isInteger(yr) || yr < 1940 || yr > 2100)) throw new UserError("Model year should look like 2016.");
      const photos = Array.isArray(d.photo_paths) ? d.photo_paths.slice(0, 4).map(String) : [];
      await run((tx) => tx`insert into boatservice.parts_requests
        (id, name, phone, email, part_name, part_number, make, model, model_year, serial, fulfillment, location, details, photo_paths, consent_share, source_page, client_hash)
        values (${id}, ${str(d.name, 120)}, ${str(d.phone, 30)}, ${str(d.email, 200)}, ${str(d.part_name, 160)}, ${str(d.part_number, 80)}, ${str(d.make, 80)},
          ${str(d.model, 80)}, ${yr}, ${str(d.serial, 80)}, ${FULFILL.includes(d.fulfillment) ? d.fulfillment : "either"}, ${str(d.location, 160)},
          ${str(d.details, 2000)}, ${photos}, true, ${str(d.source_page, 200)}, ${hash})`);
      return { ok: true, id, linked_to_account: !!who };
    }
    if (action === "partner") {
      if (!str(d.shop_name, 160) || !str(d.contact_name, 120) || !str(d.phone, 30) || !str(d.email, 200) || !str(d.service_area, 300)) throw new UserError("Please fill in shop name, contact, phone, email and service area.");
      const services = Array.isArray(d.services) ? d.services.filter((s: string) => SERVICES.includes(s) || s === "parts").slice(0, 14) : [];
      await asRole("anon", {}, (tx) => tx`insert into boatservice.partner_applications
        (shop_name, contact_name, phone, email, website, services, service_area, notes, client_hash)
        values (${str(d.shop_name, 160)}, ${str(d.contact_name, 120)}, ${str(d.phone, 30)}, ${str(d.email, 200)}, ${str(d.website, 300)},
          ${services}, ${str(d.service_area, 300)}, ${str(d.notes, 2000)}, ${hash})`);
      return { ok: true };
    }
    if (!str(d.contact, 200) || String(d.contact).trim().length < 5) throw new UserError("Please enter the phone number or email you used.");
    await asRole("anon", {}, (tx) => tx`insert into boatservice.data_requests (contact, note, client_hash) values (${str(d.contact, 200)}, ${str(d.note, 1000)}, ${hash})`);
    return { ok: true };
  }

  // ---------------- signed-in actions
  const user = (await userFromToken(req, true))!;
  return await asRole("authenticated", claimsFor(user), async (tx) => {
    if (action === "my_requests") { const [{ v }] = await tx`select boatservice.my_requests() as v`; return { ok: true, email: user.email, ...v }; }
    const [{ r }] = await tx`select boatservice.my_roles() as r`;
    if (action === "me") return { ok: true, email: user.email, admin: !!r.admin };
    if (!r.admin) throw new UserError("This login is not a staff account yet. Ask the owner to add you (see docs/SETUP.md).");
    switch (action) {
      case "stats": { const [{ s }] = await tx`select boatservice.admin_stats() as s`; return { ok: true, stats: s }; }
      case "list": {
        const status = LEAD_STATUS.includes(d.status) ? d.status : null;
        const leads = status
          ? await tx`select * from boatservice.quote_requests where status = ${status} order by created_at desc limit 1000`
          : await tx`select * from boatservice.quote_requests order by created_at desc limit 1000`;
        const parts = await tx`select * from boatservice.parts_requests order by created_at desc limit 1000`;
        const partners = await tx`select * from boatservice.partner_applications order by created_at desc limit 500`;
        const offers = await tx`select o.id, o.lead_kind, o.quote_id, o.part_id, o.partner_id, p.shop_name, p.email as shop_email, o.status, o.shop_note,
            o.quote_low, o.quote_high, o.viewed_at, o.responded_at, o.released_at, o.expires_at, o.created_at, o.summary
          from boatservice.lead_offers o join boatservice.partner_applications p on p.id = o.partner_id order by o.created_at desc limit 3000`;
        const data_requests = await tx`select * from boatservice.data_requests order by created_at desc limit 200`;
        return { ok: true, leads, parts, partners, offers, data_requests };
      }
      case "create_offers": {
        const kind = d.kind === "part" ? "part" : "quote";
        if (!uuidRe.test(String(d.id))) throw new UserError("Bad id");
        const ids = (Array.isArray(d.partner_ids) ? d.partner_ids : []).filter((x: string) => uuidRe.test(String(x))).slice(0, 20);
        if (!ids.length) throw new UserError("Pick at least one approved shop.");
        const out = [];
        for (const pid of ids) {
          const [{ v }] = await tx`select boatservice.create_offer(${kind}, ${d.id}, ${pid}, ${str(d.area, 120)}, ${str(d.notes, 1500)}) as v`;
          out.push(v);
        }
        return { ok: true, offers: out };
      }
      case "release_offer": {
        if (!uuidRe.test(String(d.offer_id))) throw new UserError("Bad id");
        const [{ v }] = await tx`select boatservice.release_offer(${d.offer_id}) as v`;
        return { ok: true, ...v };
      }
      case "withdraw_offer": {
        if (!uuidRe.test(String(d.offer_id))) throw new UserError("Bad id");
        const [{ v }] = await tx`select boatservice.withdraw_offer(${d.offer_id}) as v`;
        return { ok: true, ...v };
      }
      case "update_lead": case "update_part": {
        if (!uuidRe.test(String(d.id))) throw new UserError("Bad id");
        if (!LEAD_STATUS.includes(d.status)) throw new UserError("Bad status");
        const res = action === "update_lead"
          ? await tx`update boatservice.quote_requests set status = ${d.status}, staff_note = ${str(d.staff_note, 2000)} where id = ${d.id}`
          : await tx`update boatservice.parts_requests set status = ${d.status}, staff_note = ${str(d.staff_note, 2000)} where id = ${d.id}`;
        return { ok: res.count === 1 };
      }
      case "update_partner": {
        if (!uuidRe.test(String(d.id)) || !PARTNER_STATUS.includes(d.status)) throw new UserError("Bad input");
        const res = await tx`update boatservice.partner_applications set status = ${d.status}, staff_note = ${str(d.staff_note, 2000)} where id = ${d.id}`;
        return { ok: res.count === 1 };
      }
      case "update_data_request": {
        if (!uuidRe.test(String(d.id))) throw new UserError("Bad id");
        const res = await tx`update boatservice.data_requests set status = ${d.status === "done" ? "done" : "new"} where id = ${d.id}`;
        return { ok: res.count === 1 };
      }
      case "delete": {
        const table = { lead: "quote_requests", part: "parts_requests", partner: "partner_applications", data_request: "data_requests" }[String(d.kind)];
        if (!table || !uuidRe.test(String(d.id))) throw new UserError("Bad input");
        const res = await tx.unsafe(`delete from boatservice.${table} where id = $1 returning ${table === "quote_requests" || table === "parts_requests" ? "photo_paths" : "null as photo_paths"}`, [d.id]);
        return { ok: res.length === 1, photo_paths: res[0]?.photo_paths ?? [] };
      }
    }
    throw new UserError("Unknown action");
  });
}

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: true, service: "boatservice-api", version: "v2" }), { headers: h });
  try {
    const text = await req.text();
    if (text.length > 20000) throw new UserError("Request too large.");
    const body = JSON.parse(text || "{}");
    return new Response(JSON.stringify(await handle(req, body)), { headers: h });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    let msg = "Something went wrong. Please try again.";
    let status = 500;
    if (e instanceof UserError) { msg = e.message; status = 400; }
    else if (err.code === "54000") { msg = err.message ?? msg; status = 429; }
    else if (err.code === "22023") { msg = err.message ?? msg; status = 400; }
    else if (err.code === "23514") { msg = "Please check the form and try again."; status = 400; }
    else if (err.code === "42501") { msg = "Not allowed."; status = 403; }
    else if (e instanceof SyntaxError) { msg = "Bad request."; status = 400; }
    else console.error(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: h });
  }
});
