/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL for the shared shopping list (optional) */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon public key (safe to ship; see supabase/README.md) */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
