# Self-hosting sync

GuriTube syncs your bookmarks, folders, watch history, settings and user-styles
through **your own Supabase** — you own the database and the data never touches a
third party. Auth is a passwordless **email magic link**; a second device can be
signed in by scanning a **QR code** from an already-signed-in device.

## 1. Get a Supabase instance

Either works:

- **Supabase Cloud** — create a free project at <https://supabase.com>. Simplest.
- **Self-hosted** — run the stack with Docker
  (<https://supabase.com/docs/guides/self-hosting/docker>) or Coolify. Full
  control, no third party at all.

## 2. Apply the schema

Run `supabase/migrations/20260101000000_init_sync.sql` against your project:

- Dashboard → **SQL Editor** → paste and run, or
- CLI: `supabase db push`, or
- `psql "$DATABASE_URL" -f supabase/migrations/20260101000000_init_sync.sql`

It creates `nou_bookmarks`, `nou_folders`, `nou_history`, `nou_settings` and
`nou_user_styles`, all protected by Row Level Security so each account only ever
sees its own rows.

## 3. Configure auth

- **Email magic link**: Dashboard → Authentication → Providers → Email, enable
  it. Configure SMTP (Authentication → Emails) so links actually get delivered —
  the cloud built-in sender is rate-limited; self-hosted needs your own SMTP.
- **Redirect URL**: add the app's deep link `noutube://auth` to
  Authentication → URL Configuration → Redirect URLs, so the magic link opens
  back in the app.

> The custom URL scheme stays `noutube` (it's wired to the auth deep link);
> that's independent of the GuriTube branding.

## 3.5. Grant yourself premium

Sync is a gated capability (it can become a paid product later), so it only runs
for accounts whose plan isn't `free`. The schema seeds every new account as
`free`; after your **first sign-in**, promote your account once as admin (SQL
Editor / psql):

```sql
update public.nou_profiles set plan = 'premium'
  where user_id = (select id from auth.users where email = 'you@example.com');
```

Users can read their own plan but can't change it, so only accounts you grant
premium will sync.

## 4. Point the app at your server

Two knobs — the Supabase URL and the anon (publishable) key from
Dashboard → Project Settings → API:

- **Build-time** (works today): set `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` before building.
- **In-app** (planned): a "Sync server" field under Settings → Sync to paste the
  URL + anon key without rebuilding. _(client change tracked separately)_

The anon key is safe to ship — it only grants the `anon`/`authenticated` roles,
and RLS is what actually protects the data.

## 5. Pair a second device (QR)

On a signed-in device, open Settings → Sync → **Pair a device** to show a QR that
encodes the current session. Scan it on the other device to sign in as the same
account. Treat the QR as a secret — anyone who scans it gets in.

> Self-hosted note: set `GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL` to a few
> seconds (default 10s) so the brief moment both devices share a refresh token
> doesn't trip reuse-detection and log you out.
