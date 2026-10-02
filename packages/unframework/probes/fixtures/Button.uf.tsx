import { defineSlots, type Element } from "unframework";

export interface ButtonProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  disabled?: boolean;
}

export default function Button({ size = "md", href, disabled = false }: ButtonProps) {
  const slots = defineSlots<{ default?(): Element; icon?(): Element }>();

  return (
    <component
      is={href ? "a" : "button"}
      href={href}
      class={["button", `button--${size}`]}
      disabled={disabled}
    >
      {slots.icon ? <span class="button-icon">{slots.icon()}</span> : null}
      {slots.default?.()}
    </component>
  );
}
