import { createState } from "./_unframework/createState";
import { modelText } from "./_unframework/modelText";
import type { ComponentProps, JSX } from "@solidjs/web";
import { untrack } from "solid-js";

export default function Reply(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [message, setMessage] = createState("Thanks, see you soon");
  const [signature, setSignature] = createState("Ada");

  return (
    <form aria-label="Reply" {...props}>
      <textarea
        aria-label="Message"
        value={untrack(message)}
        ref={[modelText(message, setMessage, { trim: true }), textCaret]}
      />
      <textarea
        aria-label="Signature"
        value={untrack(signature)}
        ref={[modelText(signature, setSignature, { lazy: true }), textCaret]}
      />
      <output>
        [{message()}] from {signature()}
      </output>
    </form>
  );
}

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
function textCaret(field: HTMLTextAreaElement) {
  const text = field.value;
  field.value = "";
  field.value = text;
}
