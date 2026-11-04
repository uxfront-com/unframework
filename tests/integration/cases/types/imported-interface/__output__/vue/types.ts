// The props of `Badge`, declared in a module of their own, as a design system declares them.
export interface BadgeProps {
  /** The text the badge shows. */
  label: string;
  tone?: "info" | "danger";
}
