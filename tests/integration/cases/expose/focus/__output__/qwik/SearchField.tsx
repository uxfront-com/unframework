import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type Signal,
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  { label: string } & Omit<PropsOf<"label">, "label" | "class" | "style" | "ref"> & {
      class?: ClassList;
      style?: CSSProperties;
      ref?: Signal<object | undefined>;
    }
>(({ label, class: className, style, ref, ...attributes }) => {
  const input = useSignal<HTMLInputElement>();

  const focus = $(() => {
    input.value?.focus();
  });

  useTask$(() => {
    exposeRef(ref, { focus });
  });
  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => exposeRef(ref, undefined));
    },
    { strategy: "document-ready" },
  );

  return (
    <label class={["search", className]} style={style} {...attributes}>
      {label}
      <input ref={input} type="search" />
    </label>
  );
});

/**
 * Fills a consumer's component ref with what the component exposes, or empties it: Qwik has no
 * component instance for the ref to hold (ADR-0054).
 */
function exposeRef(ref: Signal<object | undefined> | undefined, exposed: object | undefined): void {
  if (ref) ref.value = exposed;
}
