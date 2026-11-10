// Props types from packages, through their `exports`, `types` and DefinitelyTyped.

import type { Tagged } from "@acme/types";
import type { Kit } from "inner-kit";
import type { Uses } from "nested-user";
import type { Missing } from "not-installed";
import type { OldProps } from "old-typings";
import type { PlainProps } from "plain";
import type { Twin } from "twin";
import type { DeepProps } from "ui-deep";
import type { BaseProps, ButtonProps } from "ui-kit";
import type { Hidden } from "ui-kit/hidden";
import type { Tone } from "ui-kit/tokens";

import type { Local } from "#local";

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

export function SubpathImport(props: Local) {
  return props;
}

export function PackageSubpathImport(props: Kit) {
  return props;
}

export function RootCopy(props: Twin) {
  return props;
}

export function NestedCopy(props: Uses) {
  return props;
}

export function DependencyOfADependency(props: DeepProps) {
  return props;
}

export function Typings(props: OldProps) {
  return props;
}
