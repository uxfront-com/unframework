import { defineEmits, ref } from "unframework";

export default function SignupForm() {
  const emit = defineEmits<{
    signup: [fullName: string, email: string, plan: string, newsletter: boolean];
  }>();

  const fullName = ref("");
  const email = ref("");
  const plan = ref("free");
  const newsletter = ref(false);
  const focused = ref("none");

  function submit(event: SubmitEvent) {
    event.preventDefault();
    emit("signup", fullName.value, email.value, plan.value, newsletter.value);
  }

  return (
    <form class="signup-form" aria-label="Sign up" onSubmit={submit}>
      <label>
        Name
        <input
          name="name"
          onChange={(event) => (fullName.value = (event.currentTarget as HTMLInputElement).value)}
          onFocus={() => (focused.value = "name")}
          onBlur={() => (focused.value = "none")}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          onInput={(event) => (email.value = (event.currentTarget as HTMLInputElement).value)}
          onFocus={() => (focused.value = "email")}
          onBlur={() => (focused.value = "none")}
        />
      </label>
      <label>
        Plan
        <select
          name="plan"
          onChange={(event) => (plan.value = (event.currentTarget as HTMLSelectElement).value)}
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
      </label>
      <label>
        <input
          name="newsletter"
          type="checkbox"
          onChange={(event) =>
            (newsletter.value = (event.currentTarget as HTMLInputElement).checked)
          }
        />
        Send me the newsletter
      </label>
      <p role="status">
        {`Name: ${fullName.value}; email: ${email.value}; plan: ${plan.value}; newsletter: ${newsletter.value ? "yes" : "no"}; focus: ${focused.value}`}
      </p>
      <button type="submit">Sign up</button>
    </form>
  );
}
