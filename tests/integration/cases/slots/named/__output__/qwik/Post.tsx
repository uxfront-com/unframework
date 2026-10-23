import Card from "./Card";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ author: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ author, class: className, style, ...attributes }) => {
    return (
      <>
        <Card
          {...scopeAttributes(attributes)}
          header$={() => <h2>Release notes</h2>}
          footer$={() => <small>By {author}</small>}
          class={className}
          style={style}
        >
          <p>Slots arrive in M3.</p>
        </Card>
      </>
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
