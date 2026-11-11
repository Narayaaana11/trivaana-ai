export interface DailySeriesPoint {
  date: string;
  total: number;
  connected: number;
  unanswered: number;
  spend_inr: number;
}

/**
 * Pads sparse single-day/few-day series to a 7-day timeline ending on the
 * latest recorded date so AreaChart and BarChart render clean axes instead of
 * a solitary floating dot or oversized bar.
 */
export function padDailySeries(series?: DailySeriesPoint[] | null): DailySeriesPoint[] {
  if (!series || series.length === 0) return [];
  if (series.length >= 5) return series;

  const byDate = new Map(series.map((p) => [p.date, p]));
  const lastDateStr = series[series.length - 1].date;
  const anchor = new Date(`${lastDateStr}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime())) return series;

  const padded: DailySeriesPoint[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() - offset);
    const key = d.toISOString().slice(0, 10);
    padded.push(
      byDate.get(key) || {
        date: key,
        total: 0,
        connected: 0,
        unanswered: 0,
        spend_inr: 0,
      }
    );
  }
  return padded;
}

