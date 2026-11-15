export const STAPLES_TARGETS = { 1970: 10, 1980: 25, 1990: 25, 2000: 25, 2010: 25, 2020: 50 } as const;

export type StapleCandidate = {
  id: string;
  target_decade: number;
  title: string;
  artist: string;
  source_url: string;
  chart_year: number;
  chart_rank: number;
  chart_status: "completed" | "provisional";
  release_year: number | null;
  identity_review: "pending" | "verified";
};

export function validateStaplesShortlist(rows: StapleCandidate[]) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const identities = new Set<string>();
  for (const [decade, count] of Object.entries(STAPLES_TARGETS)) {
    if (rows.filter((row) => row.target_decade === Number(decade)).length !== count)
      errors.push(`${decade}: expected ${count} candidates`);
  }
  for (const row of rows) {
    const identity = `${row.title.trim().toLowerCase()}\u0000${row.artist.trim().toLowerCase()}`;
    if (ids.has(row.id) || identities.has(identity)) errors.push(`${row.id}: duplicate recording`);
    ids.add(row.id);
    identities.add(identity);
    if (!Object.hasOwn(STAPLES_TARGETS, row.target_decade)) errors.push(`${row.id}: unknown decade`);
    if (!Number.isInteger(row.chart_rank) || row.chart_rank < 1 || row.chart_rank > 100)
      errors.push(`${row.id}: invalid source rank`);
    if (!row.source_url.startsWith("https://")) errors.push(`${row.id}: missing source`);
    if (row.chart_year === 2026 && row.chart_status !== "provisional")
      errors.push(`${row.id}: 2026 must be provisional`);
    if (row.identity_review === "verified" && row.release_year === null)
      errors.push(`${row.id}: verified identity needs original year`);
    if (row.release_year !== null && Math.floor(row.release_year / 10) * 10 !== row.target_decade)
      errors.push(`${row.id}: recording belongs to another release decade`);
  }
  return errors;
}

export function scoringReady(row: StapleCandidate) {
  return row.identity_review === "verified" && row.release_year !== null;
}