import fs from "node:fs";
import path from "node:path";

const STORE_PATH = path.join(process.cwd(), "data", "league.json");

type YearlyRow = {
  geoId: string;
  total: number;
  daysPlayed: number;
};

export function getYearlyRanking(year: number): YearlyRow[] {
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  const store = JSON.parse(raw) as any;

  const totals = new Map<string, YearlyRow>();

  for (const [weekKey, week] of Object.entries<any>(store.weeks ?? {})) {
    if (!weekKey.startsWith(String(year))) continue;

    for (const day of Object.values<any>(week.days ?? {})) {
      for (const [geoId, score] of Object.entries<number>(day.scores ?? {})) {
        const row = totals.get(geoId) ?? {
          geoId,
          total: 0,
          daysPlayed: 0,
        };

        row.total += score;
        row.daysPlayed += 1;

        totals.set(geoId, row);
      }
    }
  }

  return [...totals.values()].sort((a, b) => b.total - a.total);
}
