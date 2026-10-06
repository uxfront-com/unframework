import { component$ } from "@qwik.dev/core";

export interface CalloutProps {
  heading: string;
  body: string;
}

export default component$<CalloutProps>(({ heading, body }) => {
  return (
    <aside
      class="callout"
      aria-label={heading}
      style={{
        "--callout-accent": "#1f4d7a",
        borderLeft: "4px solid var(--callout-accent)",
        padding: "8px 12px",
        color: "#1a1a1a",
      }}
    >
      <p style={{ margin: "0", fontWeight: "700" }}>{heading}</p>
      <p style={{ margin: "4px 0 0" }}>{body}</p>
    </aside>
  );
});
