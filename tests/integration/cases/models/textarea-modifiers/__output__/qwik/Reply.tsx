import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const message = useSignal("Thanks, see you soon");
    const signature = useSignal("Ada");

    const currentMessage = message.value;
    const messageTextarea = useSignal<HTMLTextAreaElement>();
    const currentSignature = signature.value;
    const signatureTextarea = useSignal<HTMLTextAreaElement>();

    return (
      <form aria-label="Reply" {...scopeAttributes(attributes)} class={className} style={style}>
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
  },
);

/**
 * A text control's `v-model` as Vue's `vModelText` runs it: `read` is what the control's text
 * writes, trimmed with `trim` and cast with `number` as `looseToNumber` does; `shown` is the text
 * the control shows for a value, which keeps the person's own text while it is focused and
 * reads as the value (`trim`, `lazy`), or casts to it.
 */
const modelText = {
  read<T>(element: HTMLInputElement | HTMLTextAreaElement, modifiers: TextModifiers): T {
    const text = modifiers.trim ? element.value.trim() : element.value;
    const number = Number.parseFloat(text);
    // The state's type: where the text is no number, Vue writes the text, as here.
    return (modifiers.number && !Number.isNaN(number) ? number : text) as T;
  },
  shown(
    element: HTMLInputElement | HTMLTextAreaElement | undefined,
    value: unknown,
    modifiers: TextModifiers,
  ): string {
    const text = value == null ? "" : String(value);
    if (!element || element.value === text) return text;
    if (element === document.activeElement && element.type !== "range") {
      if (modifiers.lazy || (modifiers.trim && element.value.trim() === text)) {
        return element.value;
      }
    }
    if (modifiers.number && this.read(element, modifiers) === value) return element.value;
    return text;
  },
};

/** The modifiers of a text control's `v-model`. */
interface TextModifiers {
  trim?: boolean;
  lazy?: boolean;
  number?: boolean;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
