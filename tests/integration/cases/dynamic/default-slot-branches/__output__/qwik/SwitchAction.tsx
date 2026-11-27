import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export default component$<
  { href?: string } & Omit<PropsOf<"a"> & PropsOf<"button">, "href" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ href, class: className, style, ...attributes }) => {
  const Tag = href ? "a" : "button";

  return (
    <>
      <Tag href={Tag === "a" ? href : undefined} class={className} style={style} {...attributes}>
        {href ? (
          <b>
            <Slot />
          </b>
        ) : (
          <i>
            <Slot />
          </i>
        )}
      </Tag>
    </>
  );
});
