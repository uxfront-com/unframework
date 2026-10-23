import Badge from "./Badge";
import Tag from "./Tag";
import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

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

export default component$<NoticeProps & { class?: ClassList; style?: CSSProperties }>(
  ({ title, look, declarations, vars, class: className, style, ...attributes }) => {
    const quiet = useSignal(false);

    const toggle = $(() => {
      quiet.value = !quiet.value;
    });

    const Tag_1 = quiet.value ? Tag : Badge;

    return (
      <div class={["notice", className]} {...scopeAttributes(attributes)} style={style}>
        <p style={look}>{title}</p>
        <Badge
          label="Permanent"
          tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
          style={styleObject(look)}
        />
        <p style={declarations}>Read the details before you continue.</p>
        <>
          <Tag_1 label="Optional" tone="font-weight: 700" style={styleObject(declarations)} />
        </>
        <p
          style={
            quiet.value
              ? { color: "rgb(90, 90, 90)" }
              : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" }
          }
        >
          This cannot be undone.
        </p>
        <button type="button" style={vars} onClick$={toggle}>
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
    const key = property!.trim();
    // A property is a custom property or a CSS identifier: anything else would reach the markup.
    if (value === undefined || !/^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/.test(key)) continue;
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
