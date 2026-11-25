import { chip } from "virtual:fixture-engine";

import "virtual:fixture-engine.css";

export default function Chip({ label, tone }: { label: string; tone?: "plain" | "accent" }) {
  return <span class={chip(tone)}>{label}</span>;
}
