import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface SignupFormEvents {
  onSignup?: (fullName: string, email: string, plan: string, newsletter: boolean) => void;
}

export default function SignupForm(
  props: SignupFormEvents &
    Omit<ComponentProps<"form">, "class" | "style" | "onSubmit"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onSubmit?: Extract<ComponentProps<"form">["onSubmit"], (event: never) => void>;
    },
) {
  const others = omit(props, "onSignup", "class", "onSubmit");

  const [fullName, setFullName] = createState("");
  const [email, setEmail] = createState("");
  const [plan, setPlan] = createState("free");
  const [newsletter, setNewsletter] = createState(false);
  const [focused, setFocused] = createState("none");

  function submit(event: SubmitEvent) {
    event.preventDefault();
    props.onSignup?.(fullName(), email(), plan(), newsletter());
  }

  return (
    <form
      class={props.class ? `signup-form ${props.class}` : "signup-form"}
      aria-label="Sign up"
      onSubmit={(event) => {
        submit(event);
        props.onSubmit?.(event);
      }}
      {...others}
    >
      <label>
        Name
        <input
          name="name"
          onChange={(event) => setFullName((event.currentTarget as HTMLInputElement).value)}
          onFocus={() => setFocused("name")}
          onBlur={() => setFocused("none")}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          onInput={(event) => setEmail((event.currentTarget as HTMLInputElement).value)}
          onFocus={() => setFocused("email")}
          onBlur={() => setFocused("none")}
        />
      </label>
      <label>
        Plan
        <select
          name="plan"
          onChange={(event) => setPlan((event.currentTarget as HTMLSelectElement).value)}
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
      </label>
      <label>
        <input
          name="newsletter"
          type="checkbox"
          onChange={(event) => setNewsletter((event.currentTarget as HTMLInputElement).checked)}
        />
        Send me the newsletter
      </label>
      <p role="status">{`Name: ${fullName()}; email: ${email()}; plan: ${plan()}; newsletter: ${newsletter() ? "yes" : "no"}; focus: ${focused()}`}</p>
      <button type="submit">Sign up</button>
    </form>
  );
}
