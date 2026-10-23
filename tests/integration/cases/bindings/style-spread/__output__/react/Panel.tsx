import Hint from "./Hint";
import type { CSSProperties } from "react";

type PanelLook = {
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: string;
  "--panel-gap"?: string;
};

interface PanelAttributes {
  id: string;
  title?: string;
  style?: PanelLook;
}

interface NoteAttributes {
  title: string;
  style?: string;
}

export interface PanelProps {
  heading: string;
  panel: PanelAttributes;
  note?: NoteAttributes;
}

export interface PanelAttributes_1 {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({
  heading,
  panel,
  note,
  className,
  style,
  ...attributes
}: PanelProps & PanelAttributes_1) {
  return (
    <div className={cx("panels", className)} style={style} {...scopeAttributes(attributes)}>
      <section id={panel.id} title={panel.title} style={styleObject(panel.style)} className="panel">
        <h2 style={{ marginBottom: "var(--panel-gap, 4px)" }}>{heading}</h2>
        <p title={note?.title} style={styleObject(note?.style)}>
          Changes save as you type.
        </p>
        <Hint
          text="Saved a moment ago"
          attrs={{ id: "saved-hint", style: "font-style: italic; color: rgb(90, 90, 90)" }}
          style={{ color: "rgb(30, 90, 60)" }}
        />
      </section>
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
function styleObject(style: CSSProperties | string | null | undefined): CSSProperties | undefined {
  if (typeof style !== "string") return style ?? undefined;
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    if (value === undefined) continue;
    const key = property!.trim();
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
