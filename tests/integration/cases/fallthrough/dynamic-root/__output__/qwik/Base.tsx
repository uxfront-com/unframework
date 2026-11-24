import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface BaseEvents {
  onPress$?: QRL<() => void>;
}

export default component$<
  { href?: string; disabled?: boolean; text: string } & BaseEvents &
    Omit<
      PropsOf<"a"> & PropsOf<"button">,
      "href" | "disabled" | "text" | "onPress$" | "class" | "style"
    > & { class?: ClassList; style?: CSSProperties }
>(({ href, disabled, text, onPress$, class: className, style, onClick$, ...attributes }) => {
  const press = $(() => {
    onPress$?.();
  });

  const Tag = href ? "a" : "button";

  return (
    <>
      {Tag === "a" ? (
        <a
          href={href}
          class={["base", className]}
          style={{ padding: "4px 8px", ...style }}
          preventdefault:click
          onClick$={[press, onClick$]}
          {...attributes}
        >
          {text}
        </a>
      ) : (
        <button
          disabled={disabled}
          class={["base", className]}
          style={{ padding: "4px 8px", ...style }}
          preventdefault:click
          onClick$={[press, onClick$]}
          {...attributes}
        >
          {text}
        </button>
      )}
    </>
  );
});
