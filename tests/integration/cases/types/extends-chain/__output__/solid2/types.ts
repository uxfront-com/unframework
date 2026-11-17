import type { Identified } from "./base";

export interface Labelled extends Identified {
  label: string;
}

export interface ButtonProps extends Labelled {
  disabled?: boolean;
}
