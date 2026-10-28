import Field from "./Field";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ field: FieldProps } & { class?: ClassList; style?: CSSProperties }>(
  ({ field, class: className, style, ...attributes }) => {
    return (
      <form aria-label="Sign up" {...scopeAttributes(attributes)} class={className} style={style}>
        <Field name={field.name} label={field.label} />
      </form>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
