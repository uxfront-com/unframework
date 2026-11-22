import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export interface FieldEvents {
  onClear$?: QRL<(label: string) => void>;
}

export default component$<
  FieldProps &
    FieldEvents &
    Omit<PropsOf<"div">, "label" | "tone" | "onClear$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, tone = "info", onClear$, class: className, style, ...attributes }) => {
  return (
    <div class={["field", tone, className]} style={style} {...attributes}>
      <span>{label}</span>
      <button type="button" onClick$={() => onClear$?.(label)}>
        Clear {label}
      </button>
    </div>
  );
});
