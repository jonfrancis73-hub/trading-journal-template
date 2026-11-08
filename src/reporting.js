export function reportKey(t, category) {
  const d = new Date(t.date + "T12:00:00Z");
  if (
    ["Days", "Weeks", "Months"].includes(category) &&
    (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== t.date)
  )
    return "Not Available";
  if (category === "Days")
    return (
      [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][d.getUTCDay()] || "Unknown"
    );
  if (category === "Weeks") {
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  }
  if (category === "Months") return t.date?.slice(0, 7) || "Unknown";
  if (category === "Entry time")
    return /^([01]\d|2[0-3]):[0-5]\d/.test(t.entryTime || "")
      ? t.entryTime.slice(0, 2) + ":00–:59 UK"
      : "Not Available";
  if (category === "Duration") {
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.entryTime || "") ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.exitTime || "")
    )
      return "Not Available";
    const minutes = (v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
    const n = (minutes(t.exitTime) - minutes(t.entryTime) + 1440) % 1440;
    return n < 15
      ? "Under 15 minutes"
      : n < 60
        ? "15–59 minutes"
        : "60+ minutes";
  }
  return (
    t[
      { Instruments: "asset", Strategies: "strategy", Setups: "setupName" }[
        category
      ]
    ] || "Not Available"
  );
}

export function averageRealisedR(rows) {
  const values = rows
    .map((t) => t.realisedR ?? t.realizedR)
    .filter(
      (v) =>
        v !== undefined &&
        v !== null &&
        String(v).trim() !== "" &&
        Number.isFinite(Number(v)),
    )
    .map(Number);
  return values.length
    ? values.reduce((n, v) => n + v, 0) / values.length
    : null;
}
