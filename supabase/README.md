# Shared shopping list (Supabase, free tier)

Without this the list still works, but only on one phone. With it, you and your partner
share one list that updates within a few seconds.

## One-time setup (about 5 minutes)

1. Create a free project at https://supabase.com (any region; Frankfurt or London are closest to South Africa).
2. In the project, open **SQL Editor > New query**, paste the contents of `schema.sql`, and press **Run**.
3. Open **Project Settings > API Keys** and copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - The **Publishable** key (`sb_publishable_...`, on the first tab). It is designed to be public, so it is
     safe to put in the app. On older projects use the **anon public** key from the "Legacy" tab instead.
   - Never use the **Secret** key (or the legacy `service_role` key) in the app.
4. Create `app/.env.local` with:

   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=paste-the-anon-key-here
   ```

5. Restart the app. The **My list** tab now shows **Start a shared list**.

## Using it

On one phone tap **Start a shared list** and read the 12-character code to the other phone, which
taps **Join** and types it in. Anything either of you adds or removes shows up on both.

## Privacy

The list lives in a table that the app's public key cannot read directly. The app can only call three
database functions, and each needs your household code, so nobody can browse other households. Treat the
code like a password: anyone who has it can see and change your list. Never use the `service_role` key in the app.
