export interface ButtonProps {
  label: string;
  tone?: "neutral" | "danger";
  readonly size: "sm" | "md";
  count?: number | undefined;
  onClick?: () => void;
}
