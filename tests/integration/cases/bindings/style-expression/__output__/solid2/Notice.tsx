import Badge from "./Badge";
import Tag from "./Tag";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

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

export default function Notice(
  props: NoticeProps &
    Omit<ComponentProps<"div">, "title" | "look" | "declarations" | "vars" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "look", "declarations", "vars", "class");

  const [quiet, setQuiet] = createState(false);

  function toggle() {
    setQuiet(!quiet());
  }

  return (
    <div class={props.class ? `notice ${props.class}` : "notice"} {...others}>
      <p style={styleProperties(props.look)}>{props.title}</p>
      <Badge
        label="Permanent"
        tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
        style={styleProperties(props.look)}
      />
      <p style={styleProperties(props.declarations)}>Read the details before you continue.</p>
      <Dynamic
        component={quiet() ? Tag : Badge}
        label="Optional"
        tone="font-weight: 700"
        style={styleProperties(props.declarations)}
      />
      <p
        style={styleProperties(
          quiet()
            ? { color: "rgb(90, 90, 90)" }
            : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" },
        )}
      >
        This cannot be undone.
      </p>
      <button type="button" style={styleProperties(props.vars)} onClick={toggle}>
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
  // A property is a custom property or a CSS identifier: Solid's server writes keys as they are.
  const PROPERTY = /^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/;
  const properties: Record<string, string> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      const key = property!.trim();
      // A standard name is case-insensitive, as the browser reads it: COLOR is color.
      if (value !== undefined && PROPERTY.test(key)) {
        properties[key.startsWith("--") ? key : key.toLowerCase()] = value.trim();
      }
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

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
