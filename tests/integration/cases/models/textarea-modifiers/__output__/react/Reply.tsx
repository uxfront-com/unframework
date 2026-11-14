import { type CSSProperties, type ChangeEvent, useState } from "react";

export interface ReplyAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <form aria-label="Reply" className={className} style={style} {...scopeAttributes(attributes)}>
      <textarea aria-label="Message" {...messageField} ref={messageCaret} />
      <textarea aria-label="Signature" {...signatureField} ref={signatureCaret} />
      <output>
        [{message}] from {signature}
      </output>
    </form>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}

/**
 * Binds a text field to state as Vue's `v-model` does with its modifiers: it writes on each edit
 * (as the field loses focus when `lazy`), trimmed and cast to a number as asked, and shows a new
 * state unless the focused field already means it. Gives back the field's props.
 */
function useModelText<T>(
  value: T,
  write: (value: T) => void,
  options: { lazy?: boolean; trim?: boolean; number?: boolean } = {},
): {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
} {
  const [text, setText] = useState(() => String(value ?? ""));
  const [shown, setShown] = useState(value);
  const [focused, setFocused] = useState(false);
  const read = (typed: string): T => {
    const trimmed = options.trim ? typed.trim() : typed;
    return (options.number ? looseToNumber(trimmed) : trimmed) as T;
  };
  if (!Object.is(shown, value)) {
    setShown(value);
    const current = options.number && !/^0\d/.test(text) ? looseToNumber(text) : text;
    // The focused field keeps what the person typed where it already means the state.
    const kept =
      current === (value ?? "") || (focused && options.trim && text.trim() === (value ?? ""));
    if (!kept) setText(String(value ?? ""));
  }
  return {
    value: text,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setText(event.target.value);
      if (!options.lazy) write(read(event.target.value));
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      // The native `change` of a text field: it fires as the field loses focus.
      if (options.trim) setText(text.trim());
      if (options.lazy) write(read(text));
    },
  };
}

/** Vue's `looseToNumber`: the number a text starts with, or the text where it starts with none. */
function looseToNumber(text: string): number | string {
  const number = Number.parseFloat(text);
  return Number.isNaN(number) ? text : number;
}
