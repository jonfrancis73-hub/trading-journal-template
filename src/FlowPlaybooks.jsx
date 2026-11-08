import FlowConnections from "./FlowConnections.jsx";
import { useState, useRef } from "react";
import { fields, flowNodes } from "./flow.js";
export default function FlowPlaybooks({ playbooks, onSave }) {
  const [draft, setDraft] = useState(() =>
      playbooks.map((p) => ({ ...p, nodes: flowNodes(p) })),
    ),
    [selected, setSelected] = useState(playbooks[0]?.id || ""),
    [edit, setEdit] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const diagram = useRef(null);
  const p = draft.find((p) => p.id === selected),
    nodes = p?.nodes || [];
  const update = (patch) =>
    setDraft((all) =>
      all.map((v) => (v.id === selected ? { ...v, ...patch } : v)),
    );
  const nodeUpdate = (id, patch) =>
    update({ nodes: nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  return (
    <section className="panel flow-editor">
      <div className="panel-head">
        <h2>Trading plan flowcharts</h2>
        <button className="secondary" onClick={() => setEdit(!edit)}>
          {edit ? "Review mode" : "Edit mode"}
        </button>
      </div>
      <div className="head-actions">
        <select
          aria-label="Selected playbook"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select playbook</option>
          {draft.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          onClick={() => {
            const id = crypto.randomUUID();
            setDraft([...draft, { id, name: "New Playbook", nodes: [] }]);
            setSelected(id);
          }}
        >
          Add Playbook
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (draft.some((p) => !String(p.name || "").trim()))
                throw new Error("Every playbook needs a name before saving.");
              await onSave(draft);
              setMessage("Playbooks saved.");
            } catch (e) {
              setMessage(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save Playbooks"}
        </button>
      </div>
      <p role="status">{message}</p>
      {p && (
        <>
          {edit ? (
            <label>
              Playbook name
              <input
                value={p.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
          ) : (
            <h3>{p.name}</h3>
          )}
          <div
            ref={diagram}
            className={`flow-nodes ${edit ? "editing" : "reviewing"}`}
          >
            {!edit && <FlowConnections container={diagram} nodes={nodes} />}
            {nodes.map((n, i) => (
              <article
                className={`flow-node ${n.type}`}
                id={`node-${n.id}`}
                key={n.id}
              >
                {edit ? (
                  <>
                    <label>
                      Step name
                      <input
                        value={n.title}
                        onChange={(e) =>
                          nodeUpdate(n.id, { title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Type
                      <select
                        value={n.type}
                        onChange={(e) =>
                          nodeUpdate(n.id, { type: e.target.value })
                        }
                      >
                        {["start", "process", "decision", "end"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Description
                      <textarea
                        value={n.description || ""}
                        onChange={(e) =>
                          nodeUpdate(n.id, { description: e.target.value })
                        }
                      />
                    </label>
                    {(n.type === "decision" ? ["yes", "no"] : ["next"]).map(
                      (branch) => (
                        <label key={branch}>
                          {branch} →
                          <select
                            value={n[branch] || ""}
                            onChange={(e) =>
                              nodeUpdate(n.id, { [branch]: e.target.value })
                            }
                          >
                            <option value="">Stop / no connection</option>
                            {nodes
                              .filter((x) => x.id !== n.id)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.title}
                                </option>
                              ))}
                          </select>
                        </label>
                      ),
                    )}
                    <div className="head-actions">
                      {[-1, 1].map((delta) => (
                        <button
                          key={delta}
                          className="secondary"
                          disabled={i + delta < 0 || i + delta >= nodes.length}
                          onClick={() => {
                            const a = [...nodes];
                            [a[i], a[i + delta]] = [a[i + delta], a[i]];
                            update({ nodes: a });
                          }}
                        >
                          {delta < 0 ? "Move up" : "Move down"}
                        </button>
                      ))}
                      <button
                        className="secondary"
                        onClick={() =>
                          update({
                            nodes: nodes
                              .filter((x) => x.id !== n.id)
                              .map((x) =>
                                Object.fromEntries(
                                  Object.entries(x).map(([k, v]) => [
                                    k,
                                    ["next", "yes", "no"].includes(k) &&
                                    v === n.id
                                      ? ""
                                      : v,
                                  ]),
                                ),
                              ),
                          })
                        }
                      >
                        Remove step
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <small>{n.type}</small>
                    <h3>{n.title}</h3>
                    <p>{n.description}</p>
                  </>
                )}
                <div className="flow-connections">
                  {(n.type === "decision" ? ["yes", "no"] : ["next"])
                    .filter((k) => n[k])
                    .map((k) => (
                      <a
                        key={k}
                        className={
                          k === "yes" ? "green" : k === "no" ? "red" : ""
                        }
                        href={`#node-${n[k]}`}
                      >
                        {k} ───→{" "}
                        {nodes.find((x) => x.id === n[k])?.title ||
                          "Missing step"}
                      </a>
                    ))}
                </div>
                {n.type !== "decision" && n.next === nodes[i + 1]?.id && (
                  <div aria-hidden="true" className="flow-arrow">
                    ↓
                  </div>
                )}
              </article>
            ))}
          </div>
          {edit && (
            <button
              className="secondary"
              onClick={() =>
                update({
                  nodes: [
                    ...nodes,
                    {
                      id: crypto.randomUUID(),
                      title: "New step",
                      description: "",
                      type: "process",
                    },
                  ],
                })
              }
            >
              Add step
            </button>
          )}
          <details>
            <summary>Preserved original playbook details</summary>
            {fields.map((k) => (
              <div key={k}>
                <strong>{k.replace(/([A-Z])/g, " $1")}</strong>
                <p>{Array.isArray(p[k]) ? p[k].join("\n") : p[k]}</p>
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
