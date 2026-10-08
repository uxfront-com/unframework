import { createSignal } from "solid-js";

export interface SignupFormEvents {
  onSignup?: (fullName: string, email: string, plan: string, newsletter: boolean) => void;
}

export default function SignupForm(props: SignupFormEvents) {
  const [fullName, setFullName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [plan, setPlan] = createSignal("free");
  const [newsletter, setNewsletter] = createSignal(false);
  const [focused, setFocused] = createSignal("none");

  function submit(event: SubmitEvent) {
    event.preventDefault();
    props.onSignup?.(fullName(), email(), plan(), newsletter());
  }

  return (
    <form class="signup-form" aria-label="Sign up" onSubmit={submit}>
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
