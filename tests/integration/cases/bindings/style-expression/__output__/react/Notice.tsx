import Badge from "./Badge";
import Tag from "./Tag";
import { type CSSProperties, useRef, useState } from "react";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

type NoticeVars = { "--notice-gap"?: string };

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
  vars?: NoticeVars;
}

export interface NoticeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Notice({
  title,
  look,
  declarations,
  vars,
  className,
  style,
  ...attributes
}: NoticeProps & NoticeAttributes) {
  const [quiet, setQuiet] = useState(false);
  const quietRef = useRef(quiet);

  function toggle() {
    quietRef.current = !quietRef.current;
    setQuiet(quietRef.current);
  }

  const Tag_1 = quiet ? Tag : Badge;

  return (
    <div className={cx("notice", className)} style={style} {...scopeAttributes(attributes)}>
      <p style={styleObject(look)}>{title}</p>
      <Badge
        label="Permanent"
        tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
        style={styleObject(look)}
      />
      <p style={styleObject(declarations)}>Read the details before you continue.</p>
      <Tag_1 label="Optional" tone="font-weight: 700" style={styleObject(declarations)} />
      <p
        style={styleObject(
          quiet
            ? { color: "rgb(90, 90, 90)" }
            : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" },
        )}
      >
        This cannot be undone.
      </p>
      <button type="button" style={styleObject(vars)} onClick={toggle}>
        {quiet ? "Emphasise" : "Quieten"}
      </button>
    </div>
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

/** A style bound to a value as React's style takes it: a declaration list becomes an object. */
function styleObject(style: object | string | null | undefined): CSSProperties | undefined {
  if (typeof style !== "string") return (style ?? undefined) as CSSProperties | undefined;
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    const key = property!.trim();
    // Only a CSS identifier is a property: anything else would reach the markup as written.
    if (value === undefined || !/^-?-?[A-Za-z_][\w-]*$/.test(key)) continue;
    const camel = key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    object[key.startsWith("--") ? key : camel] = value.trim();
  }
  return object as CSSProperties;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
