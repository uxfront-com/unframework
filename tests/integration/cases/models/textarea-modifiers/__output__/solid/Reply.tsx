import { modelText } from "./_unframework/modelText";
import { type ComponentProps, type JSX, createSignal, untrack } from "solid-js";
import { isServer } from "solid-js/web";

export default function Reply(
  props: Omit<ComponentProps<"form">, "style"> & { style?: JSX.CSSProperties },
) {
  const [message, setMessage] = createSignal("Thanks, see you soon");
  const [signature, setSignature] = createSignal("Ada");

  return (
    <form aria-label="Reply" {...props}>
      <textarea
        aria-label="Message"
        value={isServer ? undefined : untrack(message)}
        children={isServer ? message() : undefined}
        ref={(field) => {
          modelText(message, setMessage, { trim: true })(field);
          textCaret(field);
        }}
      />
      <textarea
        aria-label="Signature"
        value={isServer ? undefined : untrack(signature)}
        children={isServer ? signature() : undefined}
        ref={(field) => {
          modelText(signature, setSignature, { lazy: true })(field);
          textCaret(field);
        }}
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
