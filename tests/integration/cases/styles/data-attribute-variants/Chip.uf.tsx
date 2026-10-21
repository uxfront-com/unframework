import "./Chip.css";

export default function Chip({
  label,
  variant = "neutral",
  pressed = false,
}: {
  label: string;
  variant?: "neutral" | "danger";
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      class="chip"
      data-variant={variant}
      data-state={pressed ? "on" : "off"}
      aria-pressed={pressed ? "true" : "false"}
    >
      {label}
    </button>
  );
}
