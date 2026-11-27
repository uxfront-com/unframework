import OnceSlot from "./OnceSlot";
import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export default component$<
  { href?: string; label: string } & Omit<
    PropsOf<"a"> & PropsOf<"button">,
    "href" | "label" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ href, label, class: className, style, ...attributes }) => {
  const Tag = href ? "a" : "button";

  return (
    <>
      <Tag href={Tag === "a" ? href : undefined} class={className} style={style} {...attributes}>
        <OnceSlot
          label={label}
          text$={(shown) => (
            <span class="once-fill">
              <Slot>{shown.label}</Slot>
            </span>
          )}
        />
      </Tag>
    </>
  );
});
