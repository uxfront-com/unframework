import Hint from "./Hint";
import type { JSX } from "solid-js";

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

export default function Panel(props: PanelProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      class={props.class ? `panels ${props.class}` : "panels"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <section
        id={props.panel.id}
        title={props.panel.title}
        style={styleProperties(props.panel.style)}
        class="panel"
      >
        <h2 style={{ "margin-bottom": "var(--panel-gap, 4px)" }}>{props.heading}</h2>
        <p title={props.note?.title} style={styleProperties(props.note?.style)}>
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

/** A style bound to a value as an object of CSS properties. */
function styleProperties(
  style: object | string | null | undefined,
): Record<string, string> | undefined {
  if (style === null || style === undefined) return undefined;
  // A property is a custom property or a CSS identifier: Solid's server writes keys as they are.
  const PROPERTY = /^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/;
  const properties: Record<string, string> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      const key = property!.trim();
      if (value !== undefined && PROPERTY.test(key)) properties[key] = value.trim();
    }
    return properties;
  }
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined || !PROPERTY.test(key)) continue;
    const kebab = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
    properties[key.startsWith("--") ? key : kebab] = String(value);
  }
  return properties;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
