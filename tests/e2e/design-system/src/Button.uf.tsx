import "./Button.css";
import { defineEmits, defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

import type { ButtonVariant } from "./types";

export default function Button({ variant = "primary" }: { variant?: ButtonVariant }) {
  const emit = defineEmits<{ press: [] }>();
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <button type="button" class="button" data-variant={variant} onClick={() => emit("press")}>
      {slots.default?.()}
    </button>
  );
}
