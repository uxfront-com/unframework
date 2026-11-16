import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface ChoiceSlots {
  body$?: QRL<() => JSXOutput>;
}

export default component$<ChoiceSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ body$, class: className, style, ...attributes }) => {
    const first = useSignal(true);

    return (
      <div class={["choice", className]} {...scopeAttributes(attributes)} style={style}>
        <>{first.value ? <b>{body$?.()}</b> : <i>{body$?.()}</i>}</>
        <button type="button" onClick$={() => (first.value = !first.value)}>
          Switch
        </button>
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
