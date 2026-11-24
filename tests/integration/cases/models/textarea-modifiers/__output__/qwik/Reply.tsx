import { modelText } from "./_unframework/modelText";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"form">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const message = useSignal("Thanks, see you soon");
  const signature = useSignal("Ada");

  const currentMessage = message.value;
  const messageTextarea = useSignal<HTMLTextAreaElement>();
  const currentSignature = signature.value;
  const signatureTextarea = useSignal<HTMLTextAreaElement>();

  return (
    <form aria-label="Reply" class={className} style={style} {...attributes}>
      <textarea
        aria-label="Message"
        ref={messageTextarea}
        value={modelText.shown(messageTextarea.value, currentMessage, { trim: true })}
        onInput$={(_, element) => (message.value = modelText.read(element, { trim: true }))}
      />
      <textarea
        aria-label="Signature"
        ref={signatureTextarea}
        value={modelText.shown(signatureTextarea.value, currentSignature, { lazy: true })}
        onChange$={(_, element) => (signature.value = modelText.read(element, { lazy: true }))}
      />
      <output>
        [{message.value}] from {signature.value}
      </output>
    </form>
  );
});
