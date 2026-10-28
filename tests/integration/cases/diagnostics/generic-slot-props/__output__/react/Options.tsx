import type { CSSProperties, ReactNode } from "react";

export interface OptionsSlots {
  renderOption?: (props: { option: T }) => ReactNode;
}

export interface OptionsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Options({
  options,
  renderOption,
  className,
  style,
  ...attributes
}: { options: T[] } & OptionsSlots & OptionsAttributes) {
  return (
    <ul className={className} style={style} {...scopeAttributes(attributes)}>
      {options.map((option) => (
        <li key={option.value}>{renderOption?.({ option })}</li>
      ))}
    </ul>
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
