import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Badge.uf.tsx.css?inline";

export default component$<
  { label: string; count: number } & Omit<
    PropsOf<"span">,
    "label" | "count" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ label, count, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <span class={["badge", className]} data-uf-d9cef2e7="" style={style} {...attributes}>
      <span class="label" data-uf-d9cef2e7="">
        {label}
      </span>
      <span class="count" data-uf-d9cef2e7="">
        {count}
      </span>
    </span>
  );
});
