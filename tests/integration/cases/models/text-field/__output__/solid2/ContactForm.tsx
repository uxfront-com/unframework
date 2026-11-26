import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function ContactForm(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [name, setName] = createState("Ada");
  const [email, setEmail] = createState("");

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
