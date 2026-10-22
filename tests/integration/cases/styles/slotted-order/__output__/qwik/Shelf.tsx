import Amber from "./Amber";
import Blue from "./Blue";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

const items = [
  { label: "Warm", warm: true },
  { label: "Cool", warm: false },
];

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    return (
      <section {...scopeAttributes(attributes)} class={className} style={style}>
        <Blue>
          <p class="caption" data-uf-721c504a-s="">
            In blue
          </p>
        </Blue>
        <Amber>
          <p class="caption" data-uf-c97301b3-s="">
            In amber
          </p>
        </Amber>
        {items.map((item) => {
          const Tag = item.warm ? Amber : Blue;

          return (
            <div key={item.label}>
              <Tag>
                <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">
                  {item.label}
                </p>
              </Tag>
            </div>
          );
        })}
      </section>
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
