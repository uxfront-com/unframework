import { type ComponentPropsWithRef, createContext, use } from "react";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "children">;

export const ToneKey = createContext<string | undefined>(undefined);

export default function Badge({ className, style, ...attributes }: BadgeAttributes) {
  const tone = use(ToneKey) ?? "plain";

  return (
    <span className={cx("badge", className)} style={style} {...attributes}>
      Tone: {tone}
    </span>
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
