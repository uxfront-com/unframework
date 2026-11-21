import Base from "./Base";
import type { JSX } from "@solidjs/web";

export interface PrimaryEvents {
  onPress?: () => void;
}

export default function Primary(
  props: { href?: string; disabled?: boolean; text: string } & PrimaryEvents & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  return (
    <Base
      href={props.href}
      disabled={props.disabled}
      text={props.text}
      onPress={() => props.onPress?.()}
      class={props.class ? `primary ${props.class}` : "primary"}
      style={props.style}
      {...scopeAttributes(props)}
    />
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
