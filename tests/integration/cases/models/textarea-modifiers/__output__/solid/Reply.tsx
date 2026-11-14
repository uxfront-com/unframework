import { type JSX, createRenderEffect, createSignal, untrack } from "solid-js";
import { isServer } from "solid-js/web";

export default function Reply(props: { class?: string; style?: JSX.CSSProperties }) {
  const [message, setMessage] = createSignal("Thanks, see you soon");
  const [signature, setSignature] = createSignal("Ada");

  return (
    <form aria-label="Reply" class={props.class} style={props.style} {...scopeAttributes(props)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** Binds a text field to a signal as Vue's `vModelText` does: see its modifiers. */
function modelText<T extends string | number | null | undefined>(
  value: () => T,
  setValue: (value: T) => void,
  modifiers: { trim?: boolean; lazy?: boolean; number?: boolean },
): (field: HTMLInputElement | HTMLTextAreaElement) => void {
  const cast = (text: string): string | number => {
    const number = Number.parseFloat(text);
    return Number.isNaN(number) ? text : number;
  };
  return (field) => {
    field.addEventListener(modifiers.lazy ? "change" : "input", () => {
      const text = modifiers.trim ? field.value.trim() : field.value;
      setValue((modifiers.number ? cast(text) : text) as T);
    });
    if (modifiers.trim || modifiers.number) {
      field.addEventListener("change", () => {
        const text = modifiers.trim ? field.value.trim() : field.value;
        field.value = String(modifiers.number ? cast(text) : text);
      });
    }
    createRenderEffect(() => {
      const next = value() ?? "";
      const shown = modifiers.number && !/^0\d/.test(field.value) ? cast(field.value) : field.value;
      if (shown === next) return;
      const typing = document.activeElement === field && field.type !== "range";
      if (typing && modifiers.trim && field.value.trim() === next) return;
      field.value = String(next);
    });
  };
}

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
function textCaret(field: HTMLTextAreaElement) {
  const text = field.value;
  field.value = "";
  field.value = text;
}
