import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export default component$<
  { label: string; items: string[] } & Omit<
    PropsOf<"ul">,
    "label" | "items" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ label, items, class: className, style, ...attributes }) => {
  return (
    <ul class={["row-list", className]} aria-label={label} style={style} {...attributes}>
      {items.map((item) => (
        <li key={item}>
          {item} <Slot />
        </li>
      ))}
    </ul>
  );
});
