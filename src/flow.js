export const fields = [
  "setupRules",
  "entryChecklist",
  "invalidationRules",
  "managementRules",
  "mistakeWarnings",
  "exampleNotes",
];
export function flowNodes(p) {
  if (Array.isArray(p.nodes)) return p.nodes;
  const nodes = fields.flatMap((key) => {
    const v = p[key];
    return (Array.isArray(v) ? v : v ? [v] : []).map((text) => ({
      id: crypto.randomUUID(),
      title: key.replace(/([A-Z])/g, " $1"),
      description: text,
      type: "process",
    }));
  });
  return nodes.map((n, i) => ({ ...n, next: nodes[i + 1]?.id || "" }));
}
