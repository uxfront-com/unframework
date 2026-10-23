import Card from "./Card";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    return (
      <div class={["cards", className]} {...scopeAttributes(attributes)} style={style}>
        <Card label="Full" title$={() => <h3>Weather</h3>}>
          <p>Sunny, 21°</p>
        </Card>
        <Card label="Bare" />
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
