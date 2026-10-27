// Props types from packages, through their `exports`, `types` and DefinitelyTyped.

import type { Tagged } from "@acme/types";
import type { Missing } from "not-installed";
import type { PlainProps } from "plain";
import type { BaseProps, ButtonProps } from "ui-kit";
import type { Hidden } from "ui-kit/hidden";
import type { Tone } from "ui-kit/tokens";

export function Exported(props: ButtonProps) {
  return props;
}

export function StarExport(props: BaseProps & { tone: Tone }) {
  return props;
}

export function ScopedTypes(props: Tagged) {
  return props;
}

export function DefinitelyTyped(props: PlainProps) {
  return props;
}

export function Utility(props: Partial<ButtonProps>) {
  return props;
}

export function NotInstalled(props: Missing) {
  return props;
}

export function NotExported(props: Hidden) {
  return props;
}
