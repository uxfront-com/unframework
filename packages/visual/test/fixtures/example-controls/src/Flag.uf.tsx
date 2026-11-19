export default function Flag({
  label,
  on,
  tone = "info",
  size = 2,
}: {
  label: string;
  on?: boolean;
  tone?: "info" | "warn" | "error";
  size?: number;
}) {
  return (
    <span data-flag={label} data-on={on ? "yes" : "no"} data-tone={tone} data-size={size}>
      {label}
    </span>
  );
}
