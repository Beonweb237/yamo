# Supabase setup for Yamo — status

A real Supabase project is already provisioned and wired up for this machine:

- Project: `yamo` (ref `vkzsbkrjeekwhkzfuxvo`), region `eu-west-3`, org `rcwyrcjoaxdwhtxphhjq`
- Migrations `0001_init.sql` à `0007_order_picked_up_status.sql` applied
- `.env` has the anon key (used by the frontend)
- `.env.server` has the service_role key + DB password (server-only, used by `scripts/seed.mjs`)
- Seed data loaded: 12 restaurants + 20 menu items from `src/data/mockData.ts`

## What's left

**Phone OTP is not usable yet.** Supabase Auth's Phone provider needs an SMS provider
(Twilio, MessageBird, etc.) configured in the dashboard: Authentication → Providers → Phone.
Without it, `sendOtp`/`verifyOtp` in `src/contexts/AuthContext.tsx` will fail against this
project. Until that's set up, either:
- configure a Twilio account and wire it in the Supabase dashboard, or
- unset `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` locally to fall back to the local
  mock-auth mode (any OTP code is accepted) for UI testing.

## Useful commands

```bash
# see linked project / other projects in the org
supabase projects list

# re-apply migrations after editing supabase/migrations/*.sql
SUPABASE_DB_PASSWORD=<see .env.server> supabase db push

# re-fetch API keys
supabase projects api-keys --project-ref vkzsbkrjeekwhkzfuxvo

# re-run the seed (will duplicate rows if run twice — clear the tables first if needed)
npm run seed
```


