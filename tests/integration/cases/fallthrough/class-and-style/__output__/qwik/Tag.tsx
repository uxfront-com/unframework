import { component$ } from "@qwik.dev/core";

export default component$<{ label: string }>(({ label }) => {
  return (
    <span class="tag" style={{ padding: "2px 6px", color: "rgb(30, 30, 30)" }}>
      {label}
    </span>
  );
});
