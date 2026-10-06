// SVG titles of one part and of several, which Qwik's JSX types take only as a string (ADR-0040):
// emit.test.ts pins the forms the target writes, typecheck.test.ts checks them against Qwik's
// types (L4) and ssr/titles.test.ts renders them with Qwik's server renderer.

/** A component with a title of each form, `Icon`. */
export const TITLES = `export interface P { label: string; note?: string; n: string | null; count: number; on: boolean; xs: string[] }
export default function Icon({ label, note, n, count, on, xs }: P) {
  return (
    <svg viewBox="0 0 10 10" role="img">
      <title>{label} icon</title>
      <g><title>{note}, {count + 1}, {count}</title></g>
      <g><title>{on ? <>On: {note}</> : "Off"}</title></g>
      <g><title>[{on && " on"}{count === 0 ? "none" : count === 1 ? <>one {label}</> : <>{count} of {label}</>}]</title></g>
      <g><title>{label}{"\`\${x}\` \\\\ \\t"}</title></g>
      <g><title>a{on ? null : undefined}b</title></g>
      <g><title>{on ? "yes" : "no"}: {label.length > 2 ? label : note}</title></g>
      <g><title>{note}</title></g>
      <g><title>{count}</title></g>
      <g><title>{n}</title></g>
      <g><title>{on && note}</title></g>
      <g><title>{on && count}</title></g>
      <g><title>{on ? label : "Off"}</title></g>
      <g><title>{label.toUpperCase()}</title></g>
      <g><title>{note ?? "Untitled"} icon, {on ? note ?? "x" : "y"}, {note ?? undefined}.</title></g>
      <g><title>{on ? <>a {note ?? "x"}</> : "b"}</title></g>
      <g><title>[{on ? note ?? null : null}]</title></g>
      <g><title>{note ?? undefined}</title></g>
      <g><title>{n ?? null}</title></g>
      {xs.map((x) => <g key={x}><title>Item {x}</title></g>)}
      {on && <g><title>{label} on</title></g>}
    </svg>
  );
}`;

/** Two sets of props for {@link TITLES}, with the text of each title they render, in order. */
export const TITLE_RENDERS: readonly { props: Record<string, unknown>; titles: string[] }[] = [
  {
    props: { label: "Star <&>", n: null, count: 0, on: true, xs: ["a"] },
    titles: [
      "Star <&> icon",
      ", 1, 0",
      "On: ",
      "[ onnone]",
      "Star <&>`${x}` \\ \t",
      "ab",
      "yes: Star <&>",
      "",
      "0",
      "",
      "",
      "0",
      "Star <&>",
      "STAR <&>",
      "Untitled icon, x, .",
      "a x",
      "[]",
      "",
      "",
      "Item a",
      "Star <&> on",
    ],
  },
  {
    props: { label: "L", note: "N", n: "M", count: 2, on: false, xs: [] },
    titles: [
      "L icon",
      "N, 3, 2",
      "Off",
      "[2 of L]",
      "L`${x}` \\ \t",
      "ab",
      "no: N",
      "N",
      "2",
      "M",
      "",
      "",
      "Off",
      "L",
      "N icon, y, N.",
      "b",
      "[]",
      "N",
      "M",
    ],
  },
];
