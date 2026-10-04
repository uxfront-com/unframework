// UF3009 ambiguous-jsx-text: a raw tab in JSX text, which Babel reads as a space and TypeScript
// and oxc keep; the likely fix writes a space.
export default function Field() {
  return <p>Name:	Ada</p>;
}
