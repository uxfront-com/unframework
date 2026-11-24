import type { ComponentPropsWithoutRef, Ref } from "react";

export type FieldAttributes = Omit<ComponentPropsWithoutRef<"input">, "label" | "children"> & {
  ref?: Ref<HTMLLabelElement>;
};

export default function Field({
  label,
  className,
  style,
  ref,
  ...attributes
}: { label: string } & FieldAttributes) {
  return (
    <label className="field" {...scopeAttributes(attributes)} ref={ref}>
      {label}{" "}
      <input
        name={label.toLowerCase()}
        className={className}
        style={style}
        {...restAttributes(attributes)}
      />
    </label>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}

/** What the consumer passes, but the scope attributes of its styled parents, which the root keeps. */
function restAttributes<T extends object>(props: T): T {
  const rest = { ...props };
  for (const key of Object.keys(rest)) {
    if (key.startsWith("data-uf-")) Reflect.deleteProperty(rest, key);
  }
  return rest;
}
