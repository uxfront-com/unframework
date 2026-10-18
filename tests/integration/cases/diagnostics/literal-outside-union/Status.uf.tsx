// UF3039 literal-outside-union: a prop typed by a union of literals takes one of them; `"warn"`
// is none of `tone`'s, and the likely fix writes `"warning"`.
function Badge({ tone }: { tone: "info" | "warning" }) {
  return <span class={["badge", tone]}>{tone}</span>;
}

export default function Status() {
  return (
    <p>
      Disk space: <Badge tone="warn" />
    </p>
  );
}
