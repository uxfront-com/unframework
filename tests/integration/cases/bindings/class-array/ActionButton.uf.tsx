export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

export default function ActionButton({
  label,
  size,
  primary,
  busy = false,
  badge,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      class={[
        "button",
        [`button-${size}`, primary && "button-primary"],
        busy && "is-busy button-waiting",
        badge && "has-badge",
        primary ? "solid" : "outline",
      ]}
    >
      {label}
    </button>
  );
}
