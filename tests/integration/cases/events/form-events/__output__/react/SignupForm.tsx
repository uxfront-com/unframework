import { cx } from "./_unframework/cx";
import { listen } from "./_unframework/listen";
import { type ComponentPropsWithRef, type SubmitEvent, useRef, useState } from "react";

export interface SignupFormEvents {
  onSignup?: (fullName: string, email: string, plan: string, newsletter: boolean) => void;
}

export type SignupFormAttributes = Omit<ComponentPropsWithRef<"form">, "onSignup" | "children">;

export default function SignupForm({
  onSignup,
  className,
  style,
  onSubmit,
  ...attributes
}: SignupFormEvents & SignupFormAttributes) {
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
    <form
      className={cx("signup-form", className)}
      aria-label="Sign up"
      onSubmit={(event) => {
        submit(event);
        onSubmit?.(event);
      }}
      style={style}
      {...attributes}
    >
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
