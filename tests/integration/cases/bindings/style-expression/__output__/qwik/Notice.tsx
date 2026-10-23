import Badge from "./Badge";
import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

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

export default component$<NoticeProps & { class?: ClassList; style?: CSSProperties }>(
  ({ title, look, declarations, class: className, style, ...attributes }) => {
    const quiet = useSignal(false);

    const toggle = $(() => {
      quiet.value = !quiet.value;
    });

    return (
      <div class={["notice", className]} {...scopeAttributes(attributes)} style={style}>
        <p style={look}>{title}</p>
        <Badge
          label="Permanent"
          tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
          style={styleObject(look)}
        />
        <p style={declarations}>Read the details before you continue.</p>
        <p
          style={
            quiet.value
              ? { color: "rgb(90, 90, 90)" }
              : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" }
          }
        >
          This cannot be undone.
        </p>
        <button type="button" onClick$={toggle}>
          {quiet.value ? "Emphasise" : "Quieten"}
        </button>
      </div>
    );
  },
);

/**
 * A style bound to a value as an object, which a merge spreads: a declaration list splits as
 * Vue's parseStringStyle splits it, with camel-case keys.
 */
function styleObject(style: object | string | null | undefined): Record<string, string> {
  if (typeof style !== "string") return { ...style };
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    if (value === undefined) continue;
    const key = property!.trim();
    const camel = key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    object[key.startsWith("--") ? key : camel] = value.trim();
  }
  return object;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
