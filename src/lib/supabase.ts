import { createClient } from "@supabase/supabase-js"

export const SUPABASE_URL = "https://<project>.supabase.co"
export const SUPABASE_ANON_KEY = "<anon key>"
export const IS_SUPABASE_PLACEHOLDER = SUPABASE_URL.includes("<project>")

export const db = IS_SUPABASE_PLACEHOLDER
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
