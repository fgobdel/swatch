// Your Supabase project's public connection details.
// The "publishable" key is meant to be used in client-side code like this —
// it's not a secret (that's why it's a different key from the "secret" one).
const SUPABASE_URL = "https://erbrkccwsouqcxzzsycc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PpzL75B7_gCMk0YugdEoWg_lvh9MjEP";

// One shared client, used by every page.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const STORAGE_BUCKET = "swatch-images";
