// The child the alias comes from: `tone` is typed by `Tone`, an alias of a union of literals
// declared in this module, which a parent's compile reads through the child's API (ADR-0067).
export type Tone = "info" | "warning";

export default function Tag({ tone }: { tone: Tone }) {
  return <span class={["tag", tone]}>{tone}</span>;
}
