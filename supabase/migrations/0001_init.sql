-- NotiHack initial schema: hackathons, their registration status history, geocode cache.

create type registration_status as enum ('announced', 'open', 'closed');

create table hackathons (
  id bigint generated always as identity primary key,
  source text not null,
  source_id text not null,
  title text not null,
  url text not null,
  starts_on date,
  ends_on date,
  registration_status registration_status not null,
  is_online boolean not null default false,
  location_text text,
  lat double precision,
  lng double precision,
  themes text[] not null default '{}',
  prize_text text,
  registrations_count integer,
  organizer text,
  image_url text,
  description text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  unique (source, source_id)
);

create index hackathons_status_idx on hackathons (registration_status);
create index hackathons_starts_on_idx on hackathons (starts_on);

-- Every time a hackathon's registration status changes (or it is first seen),
-- one row lands here. The mail job reads unprocessed 'open' rows.
create table status_events (
  id bigint generated always as identity primary key,
  hackathon_id bigint not null references hackathons (id) on delete cascade,
  from_status registration_status,
  to_status registration_status not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index status_events_unprocessed_idx on status_events (created_at) where processed_at is null;

create table geocode_cache (
  query text primary key,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- The globe is public: anyone may read hackathons. Only the service role
-- (used by the scheduled jobs) may write; it bypasses row level security.
alter table hackathons enable row level security;
alter table status_events enable row level security;
alter table geocode_cache enable row level security;

create policy "hackathons are public" on hackathons for select to anon, authenticated using (true);
