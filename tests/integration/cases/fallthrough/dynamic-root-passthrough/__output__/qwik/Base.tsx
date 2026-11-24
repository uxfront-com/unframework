import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  sync$,
} from "@qwik.dev/core";

export default component$<
  { href?: string; disabled?: boolean; text: string } & Omit<
    PropsOf<"a"> & PropsOf<"button">,
    "href" | "disabled" | "text" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ href, disabled, text, class: className, style, onClick$, ...attributes }) => {
  const Tag = href ? "a" : "button";

  return (
    <>
      {Tag === "a" ? (
        <a
          href={href}
          class={["base", className]}
          title="Base"
          preventdefault:click
          onClick$={[
            sync$((event: MouseEvent) => {
              event.preventDefault();
            }),
            onClick$,
          ]}
          style={style}
          {...attributes}
        >
          {text}
        </a>
      ) : (
        <button
          disabled={disabled}
          class={["base", className]}
          title="Base"
          preventdefault:click
          onClick$={[
            sync$((event: MouseEvent) => {
              event.preventDefault();
            }),
            onClick$,
          ]}
          style={style}
          {...attributes}
        >
          {text}
        </button>
      )}
    </>
  );
});
