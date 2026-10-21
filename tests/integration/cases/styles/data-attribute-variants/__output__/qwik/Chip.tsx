import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { label: string; variant?: "neutral" | "danger"; pressed?: boolean } & {
    class?: ClassList;
    style?: CSSProperties;
  }
>(({ label, variant = "neutral", pressed = false, class: className, style }) => {
  return (
    <button
      type="button"
      class={["chip", className]}
      data-variant={variant}
      data-state={pressed ? "on" : "off"}
      aria-pressed={pressed ? "true" : "false"}
      data-uf-69db3802=""
      style={style}
    >
      {label}
    </button>
  );
});
