import { type ComponentProps, type JSX, createSignal } from "solid-js";

export default function ContactForm(
  props: Omit<ComponentProps<"form">, "style"> & { style?: JSX.CSSProperties },
) {
  const [name, setName] = createSignal("Ada");
  const [email, setEmail] = createSignal("");

  return (
    <form aria-label="Contact" {...props}>
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
