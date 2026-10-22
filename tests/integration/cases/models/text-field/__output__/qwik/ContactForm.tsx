import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const name = useSignal("Ada");
    const email = useSignal("");

    const currentName = name.value;
    const currentEmail = email.value;

    return (
      <form aria-label="Contact" {...scopeAttributes(attributes)} class={className} style={style}>
        <label>
          Name <input value={currentName} onInput$={(_, element) => (name.value = element.value)} />
        </label>
        <label>
          Email{" "}
          <input
            type="email"
            value={currentEmail}
            onInput$={(_, element) => (email.value = element.value)}
          />
        </label>
        <output>
          {name.value} at {email.value || "no address"}
        </output>
        <button type="button" onClick$={() => (name.value = "Grace")}>
          Use Grace
        </button>
      </form>
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
