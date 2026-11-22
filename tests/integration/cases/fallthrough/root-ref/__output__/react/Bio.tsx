import type { ComponentPropsWithRef } from "react";

export type BioAttributes = Pick<ComponentPropsWithRef<"input">, "ref">;

export default function Bio({ label, ref }: { label: string } & BioAttributes) {
  return <input name="bio" aria-label={label} ref={ref} />;
}
