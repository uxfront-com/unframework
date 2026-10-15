import { type CSSProperties, type ChangeEvent, useState } from "react";

export interface ProfileAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Profile({ className, style }: ProfileAttributes) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("Lisbon");
  const [weight, setWeight] = useState(0);
  const nameField = useModelText(name, setName, { trim: true });
  const cityField = useModelText(city, setCity, { lazy: true });
  const weightField = useModelText(weight, setWeight, { number: true });

  return (
    <form aria-label="Profile" className={className} style={style}>
      <label>
        Name <input {...nameField} />
      </label>
      <label>
        City <input {...cityField} />
      </label>
      <label>
        Weight <input {...weightField} />
      </label>
      <output>
        [{name}] from {city}, {weight + 1}
      </output>
    </form>
  );
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
