// Props types in a shared `.ts` module (ADR-0067): the components that use them import them by name,
// and so may their consumers.
export type Tone = "neutral" | "info" | "danger";

interface Labelled {
  label: string;
}

export interface BadgeProps extends Labelled {
  tone?: Tone;
  count?: number;
}

export type ChipProps = Readonly<Omit<BadgeProps, "count">> & { removable?: boolean };

export interface Option {
  id: string;
  label: string;
}
