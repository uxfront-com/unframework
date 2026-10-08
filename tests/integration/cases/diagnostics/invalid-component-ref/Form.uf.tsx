// UF3046 invalid-component-ref: `Hint` exposes nothing, so a ref on it holds nothing a parent can
// call.
import { useTemplateRef } from "unframework";

function Hint({ text }: { text: string }) {
  return <small class="hint">{text}</small>;
}

export default function Form() {
  const hint = useTemplateRef<{ show(): void }>();
  return (
    <form aria-label="Sign in">
      <Hint ref={hint} text="Use your work email." />
    </form>
  );
}
