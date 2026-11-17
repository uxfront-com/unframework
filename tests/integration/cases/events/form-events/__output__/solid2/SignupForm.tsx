import type { JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export interface SignupFormEvents {
  onSignup?: (fullName: string, email: string, plan: string, newsletter: boolean) => void;
}

export default function SignupForm(
  props: SignupFormEvents & { class?: string; style?: JSX.CSSProperties },
) {
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
      onSubmit={submit}
      style={props.style}
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
