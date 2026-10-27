// UF3039 literal-outside-union: a prop typed by a union of literals takes one of them; `"warn"`
// is none of `tone`'s, and the likely fix writes `"warning"`. The union may be written in place,
// as Badge's is, or reached through an alias of the child's module, as Tag's is.
import Tag from "./Tag.uf.tsx";

function Badge({ tone }: { tone: "info" | "warning" }) {
  return <span class={["badge", tone]}>{tone}</span>;
}

export default function Status() {
  return (
    <p>
      Disk space: <Badge tone="warn" /> <Tag tone="warn" />
    </p>
  );
}
