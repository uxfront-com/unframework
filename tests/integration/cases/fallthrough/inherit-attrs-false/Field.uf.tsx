import { defineOptions } from "unframework";

// Renders no class or style a consumer passes: its own layout is fixed.
export default function Field({ label }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  return (
    <label class="field">
      {label} <input name={label.toLowerCase()} />
    </label>
  );
}
