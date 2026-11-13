/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL for the shared shopping list (optional) */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon public key (safe to ship; see supabase/README.md) */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** "owner/repo" for the PS5 Refresh button when not served from <owner>.github.io/<repo>/ (optional) */
  readonly VITE_GITHUB_REPO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
