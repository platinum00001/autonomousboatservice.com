// Autonomous Boat Service — public API (Supabase Edge Function "boatservice-api", verify_jwt = false).
// Why: the website stores leads in its own schema "boatservice". This function lets the site work
// without exposing that schema in the Data API, and every query still runs under Row Level Security:
//   * public actions run as the "anon" role (insert-only policies),
//   * staff actions verify the caller's Supabase login token, then run as "authenticated" with that
//     user's id in request.jwt.claims, so only rows in boatservice.admins can read/update.
// No secrets are returned. No email/SMS is sent (no paid integrations).
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 20 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SALT = Deno.env.get("BS_HASH_SALT") ?? "boatservice-v1";

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
const SERVICES = ["engine_outboard", "engine_inboard", "winterizing", "shrink_wrap", "hull_fiberglass", "electrical", "bottom_paint", "mobile_dockside", "emergency_towing", "other"];
const URGENCY = ["emergency", "this_week", "this_month", "flexible"];
const LEAD_STATUS = ["new", "sent_to_shop", "closed"];
const PARTNER_STATUS = ["new", "contacted", "approved", "declined"];

class UserError extends Error {}
const str = (v: unknown, max: number) => {
  if (v == null) return null;
  const s = String(v).trim().slice(0, max);
  return s === "" ? null : s;
};
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

async function staffUser(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token.startsWith("sb_")) throw new UserError("Please sign in.");
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON_KEY, authorization: "Bearer " + token } });
  if (!r.ok) throw new UserError("Please sign in again.");
  const u = await r.json();
  if (!u?.id) throw new UserError("Please sign in again.");
  return { sub: u.id as string, email: u.email as string };
}

async function handle(req: Request, body: Record<string, any>) {
  const action = String(body.action ?? "");
  const d = (body.data ?? {}) as Record<string, any>;

  // ---------------- public actions (anon role)
  if (["quote", "partner", "data_request"].includes(action)) {
    if (str(body.website_url, 200)) return { ok: true }; // honeypot filled: pretend success, store nothing
    if (typeof body.t === "number" && Date.now() - body.t < 2500) return { ok: true }; // submitted too fast for a human
    const hash = await clientHash(req);
    if (action === "quote") {
      const id = uuidRe.test(String(d.id ?? "")) ? String(d.id) : crypto.randomUUID();
      const service = SERVICES.includes(d.service) ? d.service : null;
      if (!str(d.name, 120) || !str(d.phone, 30) || !str(d.location, 160) || !service) throw new UserError("Please fill in your name, phone, location and the service you need.");
      if (d.consent_share !== true) throw new UserError("Please agree to share your request with partner shops so we can match you.");
      const len = d.boat_length_ft === "" || d.boat_length_ft == null ? null : Number(d.boat_length_ft);
      if (len != null && (!isFinite(len) || len < 5 || len > 300)) throw new UserError("Boat length should be in feet, between 5 and 300.");
      const photos = Array.isArray(d.photo_paths) ? d.photo_paths.slice(0, 6).map(String) : [];
      await asRole("anon", {}, (tx) => tx`insert into boatservice.quote_requests
        (id, name, phone, email, boat_make, boat_model, boat_length_ft, engine, location, service, urgency, details, photo_paths, consent_share, source_page, client_hash)
        values (${id}, ${str(d.name, 120)}, ${str(d.phone, 30)}, ${str(d.email, 200)}, ${str(d.boat_make, 80)}, ${str(d.boat_model, 80)}, ${len},
          ${str(d.engine, 160)}, ${str(d.location, 160)}, ${service}, ${URGENCY.includes(d.urgency) ? d.urgency : "flexible"}, ${str(d.details, 3000)},
          ${photos}, true, ${str(d.source_page, 200)}, ${hash})`);
      return { ok: true, id };
    }
    if (action === "partner") {
      if (!str(d.shop_name, 160) || !str(d.contact_name, 120) || !str(d.phone, 30) || !str(d.email, 200) || !str(d.service_area, 300)) throw new UserError("Please fill in shop name, contact, phone, email and service area.");
      const services = Array.isArray(d.services) ? d.services.filter((s: string) => SERVICES.includes(s)).slice(0, 12) : [];
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

  // ---------------- staff actions (authenticated role + RLS admin check)
  const user = await staffUser(req);
  const claims = { sub: user.sub, email: user.email, aud: "authenticated" };
  return await asRole("authenticated", claims, async (tx) => {
    const [{ r }] = await tx`select boatservice.my_roles() as r`;
    if (action === "me") return { ok: true, email: user.email, admin: !!r.admin };
    if (!r.admin) throw new UserError("This login is not a staff account yet. Ask the owner to add you (see docs/SETUP.md).");
    switch (action) {
      case "stats": { const [{ s }] = await tx`select boatservice.admin_stats() as s`; return { ok: true, stats: s }; }
      case "list": {
        const status = LEAD_STATUS.includes(d.status) ? d.status : null;
        const rows = status
          ? await tx`select * from boatservice.quote_requests where status = ${status} order by created_at desc limit 1000`
          : await tx`select * from boatservice.quote_requests order by created_at desc limit 1000`;
        const partners = await tx`select * from boatservice.partner_applications order by created_at desc limit 500`;
        const data_requests = await tx`select * from boatservice.data_requests order by created_at desc limit 200`;
        return { ok: true, leads: rows, partners, data_requests };
      }
      case "update_lead": {
        if (!uuidRe.test(String(d.id))) throw new UserError("Bad id");
        if (!LEAD_STATUS.includes(d.status)) throw new UserError("Bad status");
        const res = await tx`update boatservice.quote_requests set status = ${d.status}, assigned_shop = ${str(d.assigned_shop, 160)}, staff_note = ${str(d.staff_note, 2000)} where id = ${d.id}`;
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
        const table = { lead: "quote_requests", partner: "partner_applications", data_request: "data_requests" }[String(d.kind)];
        if (!table || !uuidRe.test(String(d.id))) throw new UserError("Bad input");
        const res = await tx.unsafe(`delete from boatservice.${table} where id = $1 returning ${table === "quote_requests" ? "photo_paths" : "null as photo_paths"}`, [d.id]);
        return { ok: res.length === 1, photo_paths: res[0]?.photo_paths ?? [] };
      }
    }
    throw new UserError("Unknown action");
  });
}

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: true, service: "boatservice-api" }), { headers: h });
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
