// UF3022 invalid-class-or-style: `margin` and its longhand `marginTop` in one style object, where
// the order of the two would decide the result.
export default function Spacer() {
  return <div style={{ margin: "0", marginTop: "8px" }}>Spaced</div>;
}
