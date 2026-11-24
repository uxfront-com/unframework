// UF3046 invalid-component-ref: `Hint` exposes nothing, so a ref on it holds its root <small>
// (ADR-0118), and this ref is typed as an object of functions a parent would call.
import { useTemplateRef } from "@uxfront/unframework";

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
