interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

// Its root's style is a spread's `style` key, which a consumer's `style` merges over.
export default function Hint({ text, attrs }: HintProps) {
  return <small {...attrs}>{text}</small>;
}
