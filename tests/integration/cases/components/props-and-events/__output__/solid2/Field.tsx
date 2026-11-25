import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export interface FieldEvents {
  onClear?: (label: string) => void;
}

export default function Field(
  rawProps: FieldProps &
    FieldEvents &
    Omit<ComponentProps<"div">, "label" | "tone" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get tone() {
      return rawProps.tone === undefined ? "info" : rawProps.tone;
    },
  });
  const others = omit(props, "label", "tone", "onClear", "class");

  return (
    <div class={cx("field", props.tone, props.class)} {...others}>
      <span>{props.label}</span>
      <button type="button" onClick={() => props.onClear?.(props.label)}>
        Clear {props.label}
      </button>
    </div>
  );
}
