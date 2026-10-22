import Amber from "./Amber";
import Blue from "./Blue";
import { For, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

const items = [
  { label: "Warm", warm: true },
  { label: "Cool", warm: false },
];

export default function Shelf(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section class={props.class} style={props.style} {...scopeAttributes(props)}>
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
      <For each={items}>
        {(item) => (
          <div>
            <Dynamic component={item.warm ? Amber : Blue}>
              <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">
                {item.label}
              </p>
            </Dynamic>
          </div>
        )}
      </For>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
