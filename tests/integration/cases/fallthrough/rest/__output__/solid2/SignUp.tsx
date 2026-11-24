import Field from "./Field";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function SignUp(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [focuses, setFocuses] = createState(0);

  return (
    <form aria-label="Sign up" {...props}>
      <p id="email-hint">We never share it.</p>
      <Field
        label="Email"
        id="email"
        aria-describedby="email-hint"
        placeholder="you@example.com"
        class="wide"
        style={{ "margin-top": "4px" }}
        onFocus={() => setFocuses(focuses() + 1)}
      />
      <p>Focuses: {focuses()}</p>
    </form>
  );
}
