import Base from "./Base";
import { type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

export interface PrimaryEvents {
  onPress$?: QRL<() => void>;
}

export default component$<
  { href?: string; disabled?: boolean; text: string } & PrimaryEvents & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ href, disabled, text, onPress$, class: className, style, ...attributes }) => {
  return (
    <>
      <Base
        href={href}
        disabled={disabled}
        text={text}
        class={["primary", className]}
        onPress$={() => onPress$?.()}
        {...scopeAttributes(attributes)}
        style={style}
      />
    </>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
