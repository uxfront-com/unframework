import Lead from "./Lead";
import Member from "./Member";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ ids: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ ids, class: className, style, ...attributes }) => {
    const first = useSignal<{ reset(): void }>();

    return (
      <section
        class={["team", className]}
        aria-label="Team"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2>Team</h2>
        <button type="button" onClick$={() => first.value?.reset()}>
          Reset
        </button>
        <Member ref={first} id="ada" />
        <ul>
          {ids.map((id) => (
            <li key={id}>
              <Member id={id} />
            </li>
          ))}
        </ul>
        <Lead id="hopper" class={["lead"]} />
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
