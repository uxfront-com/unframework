import { $, type QRL, component$, useSignal } from "@qwik.dev/core";

export interface SignupFormEvents {
  onSignup$?: QRL<(fullName: string, email: string, plan: string, newsletter: boolean) => void>;
}

export default component$<SignupFormEvents>(({ onSignup$ }) => {
  const fullName = useSignal("");
  const email = useSignal("");
  const plan = useSignal("free");
  const newsletter = useSignal(false);
  const focused = useSignal("none");

  const submit = $(() => {
    onSignup$?.(fullName.value, email.value, plan.value, newsletter.value);
  });

  return (
    <form class="signup-form" aria-label="Sign up" preventdefault:submit onSubmit$={submit}>
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
});
