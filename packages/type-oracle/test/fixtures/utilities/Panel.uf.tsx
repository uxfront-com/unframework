// The five utility types of plan §5.5, over a props type from another module.

import type { ButtonProps } from "./types.ts";

interface IconButtonProps extends Omit<ButtonProps, "label"> {
  icon: string;
}

export function Partials(props: Partial<ButtonProps>) {
  return props;
}

export function Requireds(props: Required<ButtonProps>) {
  return props;
}

export function Picked(props: Pick<ButtonProps, "label" | "tone">) {
  return props;
}

export function Omitted(props: Omit<ButtonProps, "onClick" | "count">) {
  return props;
}

export function Readonlys(props: Readonly<ButtonProps>) {
  return props;
}

export function Combined(props: Required<Pick<ButtonProps, "tone">> & Omit<ButtonProps, "tone">) {
  return props;
}

export function Extending(props: IconButtonProps) {
  return props;
}
