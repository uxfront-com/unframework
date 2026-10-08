// UF2016 unknown-api: `reactive` is outside unframework's subset: state is a `ref`, whose value is
// replaced whole (ADR-0008).
import { reactive, ref } from "unframework";

export default function LoginForm() {
  const email = ref("");

  return (
    <form class="login-form" aria-label="Sign in">
      <label>
        Email
        <input
          name="email"
          type="email"
          onInput={(event) => (email.value = (event.currentTarget as HTMLInputElement).value)}
        />
      </label>
    </form>
  );
}
