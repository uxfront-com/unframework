import { type SubmitEvent, useRef, useState } from "react";

export interface SignupFormEvents {
  onSignup?: (fullName: string, email: string, plan: string, newsletter: boolean) => void;
}

export default function SignupForm({ onSignup }: SignupFormEvents) {
  const [fullName, setFullName] = useState("");
  const fullNameRef = useRef(fullName);
  const [email, setEmail] = useState("");
  const emailRef = useRef(email);
  const [plan, setPlan] = useState("free");
  const planRef = useRef(plan);
  const [newsletter, setNewsletter] = useState(false);
  const newsletterRef = useRef(newsletter);
  const [focused, setFocused] = useState("none");
  const focusedRef = useRef(focused);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    onSignup?.(fullNameRef.current, emailRef.current, planRef.current, newsletterRef.current);
  }

  const [nameListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "change", (event) => {
        fullNameRef.current = (event.currentTarget as HTMLInputElement).value;
        setFullName(fullNameRef.current);
      }),
  );

  const [newsletterListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "change", (event) => {
        newsletterRef.current = (event.currentTarget as HTMLInputElement).checked;
        setNewsletter(newsletterRef.current);
      }),
  );

  return (
    <form className="signup-form" aria-label="Sign up" onSubmit={submit}>
      <label>
        Name
        <input
          name="name"
          ref={nameListeners}
          onFocus={() => {
            focusedRef.current = "name";
            setFocused(focusedRef.current);
          }}
          onBlur={() => {
            focusedRef.current = "none";
            setFocused(focusedRef.current);
          }}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          onInput={(event) => {
            emailRef.current = (event.currentTarget as HTMLInputElement).value;
            setEmail(emailRef.current);
          }}
          onFocus={() => {
            focusedRef.current = "email";
            setFocused(focusedRef.current);
          }}
          onBlur={() => {
            focusedRef.current = "none";
            setFocused(focusedRef.current);
          }}
        />
      </label>
      <label>
        Plan
        <select
          name="plan"
          onChange={(event) => {
            planRef.current = (event.currentTarget as HTMLSelectElement).value;
            setPlan(planRef.current);
          }}
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
      </label>
      <label>
        <input name="newsletter" type="checkbox" ref={newsletterListeners} />
        Send me the newsletter
      </label>
      <p role="status">{`Name: ${fullName}; email: ${email}; plan: ${plan}; newsletter: ${newsletter ? "yes" : "no"}; focus: ${focused}`}</p>
      <button type="submit">Sign up</button>
    </form>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}
