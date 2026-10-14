# NotiHack

Get an email the moment hackathon registrations open. Explore hackathons on a 3D globe, rated for Fun, Career and Learning, and matched to your cities and interests.

The only personal data NotiHack stores is your email address and the answers to the interest form.

## How it works

1. **Ingest** (`scripts/ingest.ts`, every 3 hours via GitHub Actions) reads every source in `src/lib/sources/`, merges duplicates, looks up coordinates with OpenStreetMap, and saves the result to Supabase.
2. Every time a hackathon's registration status changes (for example from *announced* to *open*), a row is written to `status_events`. The mail job will read those.
3. The web app (Next.js on Vercel) shows the hackathons. The globe, the interest form and the mails come in the next milestones.

### Sources

| Source | How | Notes |
|---|---|---|
| Devpost | Public JSON listing (`devpost.com/api/hackathons`) | Gives registration status directly |
| MLH | schema.org markup on the season's event page | Listed as *announced* until the status checker confirms registration is open |

`src/lib/sources/schemaorg.ts` reads schema.org events from any page (JSON-LD or microdata), so many new sources only need a URL.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in once Supabase exists
npm run ingest -- --dry-run  # reads the live sources, writes data/hackathons.json, saves nothing
npm run dev
```

Checks: `npm run lint`, `npm run typecheck`, `npm test`.

### Database (Supabase, free plan, no card needed)

1. Create a project at supabase.com (region: Frankfurt).
2. Open the SQL editor and run `supabase/migrations/0001_init.sql`.
3. Add these GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
4. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Roadmap

- [x] M0 Setup
- [x] M1 Devpost + MLH readers, scheduled ingest
- [ ] M2 Detect when registration opens on other sources
- [ ] M3 Fun / Career / Learning ratings (Claude Haiku 5.5)
- [ ] M4 Globe with filters
- [ ] M5 Interest form, double opt-in, emails
