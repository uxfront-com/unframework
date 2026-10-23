import Badge from "./Badge";
import { type JSX, createSignal } from "solid-js";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
}

export default function Notice(props: NoticeProps & { class?: string; style?: JSX.CSSProperties }) {
  const [quiet, setQuiet] = createSignal(false);

  function toggle() {
    setQuiet(!quiet());
  }

  return (
    <div
      class={props.class ? `notice ${props.class}` : "notice"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p style={styleProperties(props.look)}>{props.title}</p>
      <Badge
        label="Permanent"
        tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
        style={styleProperties(props.look)}
      />
      <p style={styleProperties(props.declarations)}>Read the details before you continue.</p>
      <p
        style={styleProperties(
          quiet()
            ? { color: "rgb(90, 90, 90)" }
            : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" },
        )}
      >
        This cannot be undone.
      </p>
      <button type="button" onClick={toggle}>
        {quiet() ? "Emphasise" : "Quieten"}
      </button>
    </div>
  );
}

/** A style bound to a value as an object of CSS properties. */
function styleProperties(
  style: object | string | null | undefined,
): Record<string, string> | undefined {
  if (style === null || style === undefined) return undefined;
  const properties: Record<string, string> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      if (value !== undefined) properties[property!.trim()] = value.trim();
    }
    return properties;
  }
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined) continue;
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
