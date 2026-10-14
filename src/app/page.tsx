import { createClient } from "@supabase/supabase-js";

// Placeholder until the globe (M4): lists what the ingest job has collected.
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  title: string;
  url: string;
  starts_on: string | null;
  registration_status: "announced" | "open" | "closed";
  is_online: boolean;
  location_text: string | null;
};

async function loadHackathons(): Promise<Row[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from("hackathons")
    .select("id,title,url,starts_on,registration_status,is_online,location_text")
    .neq("registration_status", "closed")
    .order("starts_on", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return data as Row[];
}

const STATUS_LABEL: Record<Row["registration_status"], string> = {
  open: "Registration open",
  announced: "Announced",
  closed: "Closed",
};

export default async function Home() {
  const hackathons = await loadHackathons();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">NotiHack</h1>
      <p className="mt-2 opacity-80">
        Get an email the moment hackathon registrations open. The globe and alerts are coming soon.
      </p>

      {hackathons === null ? (
        <p className="mt-8 rounded border border-current/20 p-4 text-sm">
          No database connected yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-current/10">
          {hackathons.map((h) => (
            <li key={h.id} className="py-3">
              <a href={h.url} className="font-medium underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                {h.title}
              </a>
              <div className="text-sm opacity-70">
                {h.starts_on ?? "Date unknown"} · {h.is_online ? "Online" : h.location_text ?? "Location unknown"} ·{" "}
                {STATUS_LABEL[h.registration_status]}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
