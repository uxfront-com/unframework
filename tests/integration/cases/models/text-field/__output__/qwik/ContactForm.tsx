import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const name = useSignal("Ada");
    const email = useSignal("");

    const currentName = name.value;
    const currentEmail = email.value;

    return (
      <form aria-label="Contact" class={className} style={style}>
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
