import Base from "./Base";
import type { ComponentPropsWithoutRef, Ref } from "react";

export interface PrimaryEvents {
  onPress?: () => void;
}

export type PrimaryAttributes = Omit<
  ComponentPropsWithoutRef<typeof Base>,
  "href" | "disabled" | "text" | "onPress" | "children"
> & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function Primary({
  href,
  disabled,
  text,
  onPress,
  className,
  style,
  ...attributes
}: { href?: string; disabled?: boolean; text: string } & PrimaryEvents & PrimaryAttributes) {
  return (
    <Base
      href={href}
      disabled={disabled}
      text={text}
      className={cx("primary", className)}
      onPress={() => onPress?.()}
      style={style}
      {...attributes}
    />
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
