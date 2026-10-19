/*
 * Autonomous Boat Service — public site configuration (edit here, nowhere else).
 * The Supabase URL and publishable key are PUBLIC by design: security is enforced by Row Level
 * Security (supabase/schema.sql) and the "boatservice-api" edge function.
 * NEVER put a service_role / secret key here.
 */
window.ABS_CONFIG = {
  // The business phone. While it is the placeholder below, every "Call" button stays hidden and the
  // quote form is the main call to action. Replace with the real Twilio / Google Voice number
  // (it forwards calls to partner shops — see docs/SETUP.md), e.g. "(508) 555-0123", then
  // run `python3 tools/build.py` so the SEO data (JSON-LD) picks it up too.
  PHONE: "(000) 000-0000 — coming soon",

  // Optional public inbox. Empty = no email address is shown anywhere (forms are the contact path).
  CONTACT_EMAIL: "",

  SUPABASE_URL: "https://oiousqgzqcjanikglkxl.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_IJHa5taHcttV2DSZq45fWQ_bVbRDbA2", // publishable key (safe to publish)
  SUPABASE_SCHEMA: "boatservice",          // this site's own schema in the shared "james-sites" project
  API_FUNCTION: "boatservice-api",         // edge function that stores forms and serves the staff page
  PHOTO_BUCKET: "boatservice-photos",      // private bucket: public can upload, only staff can view

  // TODO(James): social accounts are NOT created yet. Paste full profile URLs once they exist;
  // empty entries are simply not shown.
  SOCIAL: {
    facebook: "",  // TODO e.g. https://www.facebook.com/autonomousboatservice
    instagram: "", // TODO e.g. https://www.instagram.com/autonomousboatservice/
    x: ""          // TODO e.g. https://x.com/...
  }
};
