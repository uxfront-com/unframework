// Props types imported from other modules.

import type { FieldProps } from "./Field.uf.tsx";
import type { Missing } from "./missing.ts";
import type { Extra, Root, Tone } from "./reexports.ts";
import type { TreeNode } from "./tree.ts";
import type { Labelled, Size } from "./types.ts";
import type { Hidden } from "./types.ts";

export function Extended(props: Labelled) {
  return props;
}

export function LiteralUnions(props: { size: Size; tone?: Tone }) {
  return props;
}

export function Intersected(props: Root & Extra) {
  return props;
}

export function Child(props: FieldProps) {
  return props;
}

export function Recursive(props: TreeNode) {
  return props;
}

export function MissingModule(props: Missing) {
  return props;
}

export function MissingExport(props: Hidden) {
  return props;
}
