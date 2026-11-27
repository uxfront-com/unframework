import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface ActionSlots {
  icon$?: QRL<() => JSXOutput>;
}

export default component$<
  { href?: string; label: string } & ActionSlots &
    Omit<PropsOf<"a"> & PropsOf<"button">, "href" | "label" | "icon$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ href, label, icon$, class: className, style, ...attributes }) => {
  const Tag = href ? "a" : "button";

  return (
    <>
      <Tag
        href={Tag === "a" ? href : undefined}
        class={["action", className]}
        style={style}
        {...attributes}
      >
        {icon$?.()}
        <span data-slot="label">
          <Slot>{label}</Slot>
        </span>
      </Tag>
    </>
  );
});
