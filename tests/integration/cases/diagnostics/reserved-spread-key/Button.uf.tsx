// UF3049 reserved-spread-key: a spread renders attributes, and `key` has a channel of its own.
export interface ButtonAttrs {
  title: string;
  key: string;
}

export default function Button({ attrs }: { attrs: ButtonAttrs }) {
  return (
    <button type="button" {...attrs}>
      Go
    </button>
  );
}
