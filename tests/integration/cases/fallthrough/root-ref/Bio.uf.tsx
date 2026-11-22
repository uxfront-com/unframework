import { defineOptions } from "@uxfront/unframework";

// Turns fallthrough off and spreads no rest: a ref on it still holds its root element.
export default function Bio({ label }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  return <input name="bio" aria-label={label} />;
}
