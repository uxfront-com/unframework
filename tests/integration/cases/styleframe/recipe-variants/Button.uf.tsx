import { button } from "virtual:styleframe";

import "virtual:styleframe.css";

export default function Button({
  label,
  size,
  tone,
}: {
  label: string;
  size?: "sm" | "lg";
  tone?: "neutral" | "primary";
}) {
  return (
    <button type="button" class={button({ size, tone })}>
      {label}
    </button>
  );
}
