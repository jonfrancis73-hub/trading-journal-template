export function calendarCells(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + index);
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      day: d.getUTCDate(),
      inMonth: date.slice(0, 7) === monthKey,
    };
  });
}
export function calendarWeek(cells, index, days) {
  const row = cells.slice(index - 6, index + 1),
    map = new Map(days.map((d) => [d.date, d]));
  return {
    start: row[0].date,
    end: row[6].date,
    pnl: row.reduce((n, c) => n + (map.get(c.date)?.netPnl || 0), 0),
    count: row.reduce((n, c) => n + (map.get(c.date)?.trades || 0), 0),
  };
}
