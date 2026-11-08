import { useLayoutEffect, useState, useId } from "react";
// Measure the rendered cards so branches remain attached after edits and resizing.
export default function FlowConnections({ container, nodes }) {
  const [paths, setPaths] = useState([]),
    id = useId().replace(/:/g, "");
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const origin = element.getBoundingClientRect();
      const boxes = new Map(
        [...element.querySelectorAll(".flow-node")].map((el) => {
          const box = el.getBoundingClientRect();
          return [
            el.id.slice(5),
            {
              left: box.left - origin.left,
              right: box.right - origin.left,
              top: box.top - origin.top,
              bottom: box.bottom - origin.top,
            },
          ];
        }),
      );
      setPaths(
        nodes.flatMap((node, index) =>
          (node.type === "decision" ? ["yes", "no"] : ["next"]).flatMap(
            (branch) => {
              const source = boxes.get(node.id),
                target = boxes.get(node[branch]);
              if (!source || !target) return [];
              const adjacent =
                branch === "next" && nodes[index + 1]?.id === node[branch];
              if (adjacent) {
                const x = (source.left + source.right) / 2;
                return [
                  {
                    key: node.id + branch,
                    branch,
                    d: `M ${x} ${source.bottom} L ${x} ${target.top - 5}`,
                  },
                ];
              }
              const side = branch === "no" ? "left" : "right",
                sign = side === "left" ? -1 : 1,
                x = source[side],
                endX = target[side],
                route = x + sign * (24 + (index % 2) * 12),
                startY = (source.top + source.bottom) / 2,
                endY = (target.top + target.bottom) / 2;
              return [
                {
                  key: node.id + branch,
                  branch,
                  d: `M ${x} ${startY} H ${route} V ${endY} H ${endX + sign * 5}`,
                },
              ];
            },
          ),
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element
      .querySelectorAll(".flow-node")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [container, nodes]);
  return (
    <svg className="flow-lines" role="img" aria-label="Flowchart connections">
      <defs>
        {[
          ["yes", "#55c7a1"],
          ["no", "#ee7384"],
          ["next", "#b39adf"],
        ].map(([branch, color]) => (
          <marker
            key={branch}
            id={`${id}-${branch}`}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0 0 L6 3 L0 6 Z" fill={color} />
          </marker>
        ))}
      </defs>
      {paths.map((path) => (
        <path
          key={path.key}
          d={path.d}
          fill="none"
          stroke={
            path.branch === "yes"
              ? "#55c7a1"
              : path.branch === "no"
                ? "#ee7384"
                : "#b39adf"
          }
          strokeWidth="1.8"
          markerEnd={`url(#${id}-${path.branch})`}
        >
          <title>{path.branch} connection</title>
        </path>
      ))}
    </svg>
  );
}
