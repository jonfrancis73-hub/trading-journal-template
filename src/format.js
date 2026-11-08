export function money(value) {
  const n = Number(value || 0);
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
export const pnlTone = (value) =>
  Number(value) > 0 ? "green" : Number(value) < 0 ? "red" : "blue";
