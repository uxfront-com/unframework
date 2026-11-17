import Member from "./Member";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ ids: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ ids, class: className, style, ...attributes }) => {
    const lead = useSignal(true);
    const guest = useSignal(false);

    return (
      <section
        class={["roster", className]}
        aria-label="Roster"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <button type="button" onClick$={() => (lead.value = !lead.value)}>
          Switch lead
        </button>
        <button type="button" onClick$={() => (guest.value = !guest.value)}>
          Toggle guest
        </button>
        <ul>
          {ids.map((id) => (
            <Member key={id} id={id} />
          ))}
          <>{lead.value ? <Member id="ada" /> : <Member id="linus" />}</>
          {guest.value ? <Member id="hopper" /> : null}
        </ul>
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
