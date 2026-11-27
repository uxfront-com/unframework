import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export default component$<
  { ordered: boolean; label: string; items: string[] } & Omit<
    PropsOf<"ol"> & PropsOf<"ul">,
    "ordered" | "label" | "items" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ ordered, label, items, class: className, style, ...attributes }) => {
  const Tag = ordered ? "ol" : "ul";

  return (
    <>
      <Tag class={["tag-list", className]} aria-label={label} style={style} {...attributes}>
        {items.map((item) => (
          <li key={item}>
            <Slot>{item}</Slot>
          </li>
        ))}
      </Tag>
    </>
  );
});
