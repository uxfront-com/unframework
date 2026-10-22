import Steps from "./Steps";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ steps: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ steps, class: className, style, ...attributes }) => {
    return (
      <div {...scopeAttributes(attributes)} class={className} style={style}>
        <Steps steps={steps} marker$={() => <span aria-hidden="true">&gt; </span>} />
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
