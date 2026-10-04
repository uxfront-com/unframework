export interface CalloutProps {
  heading: string;
  body: string;
}

export default function Callout(props: CalloutProps) {
  return (
    <aside
      class="callout"
      aria-label={props.heading}
      style={{
        "--callout-accent": "#1f4d7a",
        "border-left": "4px solid var(--callout-accent)",
        padding: "8px 12px",
        color: "#1a1a1a",
      }}
    >
      <p style={{ margin: "0", "font-weight": "700" }}>{props.heading}</p>
      <p style={{ margin: "4px 0 0" }}>{props.body}</p>
    </aside>
  );
}
