import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

const Countdown = component$<{ from: number } & { class?: ClassList; style?: CSSProperties }>(
  ({ from, class: className, style, ...attributes }) => {
    return (
      <div class={["level", className]} {...scopeAttributes(attributes)} style={style}>
        <span>{from}</span>
        {from > 0 ? <Countdown from={from - 1} /> : <strong>Liftoff</strong>}
      </div>
    );
  },
);
export default Countdown;

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
