import EachSlot from "./EachSlot";
import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export default component$<
  { href?: string; items: string[] } & Omit<
    PropsOf<"a"> & PropsOf<"button">,
    "href" | "items" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ href, items, class: className, style, ...attributes }) => {
  const Tag = href ? "a" : "button";

  return (
    <>
      <Tag href={Tag === "a" ? href : undefined} class={className} style={style} {...attributes}>
        <EachSlot
          items={items}
          row$={({ item }) => (
            <span class="each-fill">
              <Slot>{item}</Slot>
            </span>
          )}
        />
      </Tag>
    </>
  );
});
