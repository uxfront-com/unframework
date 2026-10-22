import {
  $,
  type CSSProperties,
  type ClassList,
  type Signal,
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  { start: number } & { class?: ClassList; style?: CSSProperties; ref?: Signal<object | undefined> }
>(({ start, class: className, style, ref, ...attributes }) => {
  const count = useSignal(start);

  const increment = $(() => {
    count.value++;
  });

  const reset = $(() => {
    count.value = start;
  });

  useTask$(() => {
    exposeRef(ref, { increment, reset });
  });
  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => exposeRef(ref, undefined));
    },
    { strategy: "document-ready" },
  );

  return (
    <output class={["count", className]} {...scopeAttributes(attributes)} style={style}>
      {count.value}
    </output>
  );
});

/**
 * Fills a consumer's component ref with what the component exposes, or empties it: Qwik has no
 * component instance for the ref to hold (ADR-0054).
 */
function exposeRef(ref: Signal<object | undefined> | undefined, exposed: object | undefined): void {
  if (ref) ref.value = exposed;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
