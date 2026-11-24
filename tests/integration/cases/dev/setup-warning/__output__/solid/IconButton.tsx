import { type ComponentProps, type JSX, splitProps, untrack } from "solid-js";
import { isDev } from "solid-js/web";

export default function IconButton(
  props: { label?: string } & Omit<ComponentProps<"button">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label"]);

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
