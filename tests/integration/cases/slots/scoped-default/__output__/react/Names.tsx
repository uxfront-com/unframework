import type { CSSProperties, ReactNode } from "react";

export interface NamesSlots {
  renderDefault?: (props: { item: string }) => ReactNode;
}

export interface NamesAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Names({
  names,
  renderDefault,
  className,
  style,
}: { names: string[] } & NamesSlots & NamesAttributes) {
  return (
    <ul aria-label="Names" className={className} style={style}>
      {names.map((item) => (
        <li key={item}>{renderDefault?.({ item })}</li>
      ))}
    </ul>
  );
}
