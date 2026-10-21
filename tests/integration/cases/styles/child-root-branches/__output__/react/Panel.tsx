import Heading from "./Heading";
import Status from "./Status";
import type { CSSProperties } from "react";
import "./Panel.uf.tsx.css";

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({ className, style, ...attributes }: PanelAttributes) {
  return (
    <section
      className={cx("panel", className)}
      style={style}
      data-uf-34db6205=""
      {...scopeAttributes(attributes)}
    >
      <Heading big={true} text="Release" data-uf-34db6205="" />
      <Heading big={false} text="Notes" data-uf-34db6205="" />
      <Status busy={false} text="Save" data-uf-34db6205="" />
      <Status busy={true} text="Save" data-uf-34db6205="" />
    </section>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
