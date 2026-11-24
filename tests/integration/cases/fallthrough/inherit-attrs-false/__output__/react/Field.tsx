import type { ComponentPropsWithRef } from "react";

export type FieldAttributes = Pick<ComponentPropsWithRef<"label">, "ref">;

export default function Field({ label, ref }: { label: string } & FieldAttributes) {
  return (
    <label className="field" ref={ref}>
      {label} <input name={label.toLowerCase()} />
    </label>
  );
}
