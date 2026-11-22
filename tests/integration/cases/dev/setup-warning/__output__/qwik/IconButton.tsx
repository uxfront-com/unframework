import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";
import { isDev } from "@qwik.dev/core/build";

export default component$<
  { label?: string } & Omit<PropsOf<"button">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  if (isDev) {
    if (!label) console.warn("IconButton has no accessible name: pass it a `label`.");
  }

  return (
    <button type="button" aria-label={label} class={className} style={style} {...attributes}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" />
      </svg>
    </button>
  );
});
