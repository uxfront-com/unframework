import Base from "./Base";
import Primary from "./Primary";
import {
  type CSSProperties,
  type ClassList,
  component$,
  useSignal,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Page.uf.tsx.css?inline";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    useStyles$(styles);

    const linked = useSignal(true);
    const tone = useSignal("rgb(29, 78, 216)");
    const pressed = useSignal("none");
    const items = useSignal([
      { id: 1, href: "#one", disabled: true, label: "One" },
      { id: 2, href: "", disabled: true, label: "Two" },
    ]);

    return (
      <section
        class={["page", className]}
        data-uf-64cf7c28=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Primary
          href={linked.value ? "#docs" : undefined}
          disabled={true}
          text="Docs"
          onPress$={() => (pressed.value = "docs")}
          class={["wide"]}
          style={{ color: tone.value }}
          data-uf-64cf7c28=""
        />
        <Base
          disabled={true}
          text="Off"
          onPress$={() => (pressed.value = "off")}
          class={["off", { muted: !linked.value }]}
          data-uf-64cf7c28=""
        />
        <Base
          text="Save"
          onPress$={() => (pressed.value = "save")}
          class={["save"]}
          data-uf-64cf7c28=""
        />
        <ul aria-label="Items" data-uf-64cf7c28="">
          {items.value.map((item) => {
            const Tag = item.href ? "a" : "button";

            return (
              <li key={item.id} data-uf-64cf7c28="">
                <Tag
                  href={Tag === "a" ? item.href : undefined}
                  disabled={Tag === "button" ? item.disabled : undefined}
                  class="item"
                  data-uf-64cf7c28=""
                >
                  {item.label}
                </Tag>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick$={() => {
            linked.value = !linked.value;
            tone.value = linked.value ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)";
          }}
          data-uf-64cf7c28=""
        >
          Toggle
        </button>
        <output data-uf-64cf7c28="">{pressed.value}</output>
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
