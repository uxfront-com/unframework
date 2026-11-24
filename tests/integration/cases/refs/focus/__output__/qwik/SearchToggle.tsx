import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const field = useSignal<HTMLInputElement>();
  const trigger = useSignal<HTMLButtonElement>();

  const focusField = $(() => {
    field.value?.focus();
  });

  const returnFocus = $((event: KeyboardEvent) => {
    if (event.key === "Escape") trigger.value?.focus();
  });

  return (
    <div class={["search-toggle", className]} role="search" style={style} {...attributes}>
      <button type="button" ref={trigger} onClick$={focusField}>
        Search
      </button>
      <input name="query" aria-label="Search the docs" ref={field} onKeyDown$={returnFocus} />
    </div>
  );
});
