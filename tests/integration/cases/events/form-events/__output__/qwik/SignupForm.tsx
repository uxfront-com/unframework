import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface SignupFormEvents {
  onSignup$?: QRL<(fullName: string, email: string, plan: string, newsletter: boolean) => void>;
}

export default component$<SignupFormEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onSignup$, class: className, style, ...attributes }) => {
    const fullName = useSignal("");
    const email = useSignal("");
    const plan = useSignal("free");
    const newsletter = useSignal(false);
    const focused = useSignal("none");

    const submit = $(() => {
      onSignup$?.(fullName.value, email.value, plan.value, newsletter.value);
    });

    return (
      <form
        class={["signup-form", className]}
        aria-label="Sign up"
        preventdefault:submit
        onSubmit$={submit}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <label>
          Name
          <input
            name="name"
            onChange$={(_, element) => (fullName.value = (element as HTMLInputElement).value)}
            onFocus$={() => (focused.value = "name")}
            onBlur$={() => (focused.value = "none")}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            onInput$={(_, element) => (email.value = (element as HTMLInputElement).value)}
            onFocus$={() => (focused.value = "email")}
            onBlur$={() => (focused.value = "none")}
          />
        </label>
        <label>
          Plan
          <select
            name="plan"
            onChange$={(_, element) => (plan.value = (element as HTMLSelectElement).value)}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        <label>
          <input
            name="newsletter"
            type="checkbox"
            onChange$={(_, element) => (newsletter.value = (element as HTMLInputElement).checked)}
          />
          Send me the newsletter
        </label>
        <p role="status">{`Name: ${fullName.value}; email: ${email.value}; plan: ${plan.value}; newsletter: ${newsletter.value ? "yes" : "no"}; focus: ${focused.value}`}</p>
        <button type="submit">Sign up</button>
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
