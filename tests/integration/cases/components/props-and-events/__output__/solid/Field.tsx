import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

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
    Omit<ComponentProps<"div">, "label" | "tone" | "style"> & { style?: JSX.CSSProperties },
) {
  const props = mergeProps({ tone: "info" } satisfies Partial<FieldProps>, rawProps);
  const [, others] = splitProps(props, ["label", "tone", "onClear", "class"]);

  return (
    <div class={cx("field", props.tone, props.class)} {...others}>
      <span>{props.label}</span>
      <button type="button" onClick={() => props.onClear?.(props.label)}>
        Clear {props.label}
      </button>
    </div>
  );
}
