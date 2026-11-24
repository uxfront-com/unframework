import { type ComponentProps, type JSX, isDev } from "@solidjs/web";
import { omit, untrack } from "solid-js";

export default function IconButton(
  props: { label?: string } & Omit<ComponentProps<"button">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label");

  untrack(() => {
    if (isDev) {
      if (!props.label) console.warn("IconButton has no accessible name: pass it a `label`.");
    }
  });

  return (
    <button type="button" aria-label={props.label} {...others}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" />
      </svg>
    </button>
  );
}
