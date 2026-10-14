/** Where a hackathon's registration currently stands. */
export type RegistrationStatus = "announced" | "open" | "closed";

/** One hackathon in the shape every source reader must produce. */
export interface Hackathon {
  source: string;
  sourceId: string;
  title: string;
  url: string;
  /** ISO date (YYYY-MM-DD), or null when the source gives none. */
  startsOn: string | null;
  endsOn: string | null;
  registrationStatus: RegistrationStatus;
  isOnline: boolean;
  /** Free-text location as the source wrote it, e.g. "Munich, Germany". */
  locationText: string | null;
  lat: number | null;
  lng: number | null;
  themes: string[];
  prizeText: string | null;
  registrationsCount: number | null;
  organizer: string | null;
  imageUrl: string | null;
  description: string | null;
}

export interface SourceReader {
  name: string;
  read(fetchFn?: typeof fetch): Promise<Hackathon[]>;
}
