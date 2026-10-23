import { type JSX, createSignal } from "solid-js";

export default function ContactForm(props: { class?: string; style?: JSX.CSSProperties }) {
  const [name, setName] = createSignal("Ada");
  const [email, setEmail] = createSignal("");

  return (
    <form aria-label="Contact" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <label>
        Name <input value={name()} onInput={(event) => setName(event.currentTarget.value)} />
      </label>
      <label>
        Email{" "}
        <input
          type="email"
          value={email()}
          onInput={(event) => setEmail(event.currentTarget.value)}
        />
      </label>
      <output>
        {name()} at {email() || "no address"}
      </output>
      <button type="button" onClick={() => setName("Grace")}>
        Use Grace
      </button>
    </form>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
