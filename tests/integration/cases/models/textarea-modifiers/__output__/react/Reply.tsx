import { useModelText } from "./_unframework/useModelText";
import { type ComponentPropsWithRef, useState } from "react";

export type ReplyAttributes = Omit<ComponentPropsWithRef<"form">, "children">;

export default function Reply({ className, style, ...attributes }: ReplyAttributes) {
  const [message, setMessage] = useState("Thanks, see you soon");
  const [signature, setSignature] = useState("Ada");

  const [messageCaret] = useState(() => (element: HTMLTextAreaElement | null) => {
    if (element) {
      const text = element.value;
      element.value = "";
      element.value = text;
    }
  });

  const [signatureCaret] = useState(() => (element: HTMLTextAreaElement | null) => {
    if (element) {
      const text = element.value;
      element.value = "";
      element.value = text;
    }
  });

  const messageField = useModelText(message, setMessage, { trim: true });
  const signatureField = useModelText(signature, setSignature, { lazy: true });

  return (
    <form aria-label="Reply" className={className} style={style} {...attributes}>
      <textarea aria-label="Message" {...messageField} ref={messageCaret} />
      <textarea aria-label="Signature" {...signatureField} ref={signatureCaret} />
      <output>
        [{message}] from {signature}
      </output>
    </form>
  );
}
