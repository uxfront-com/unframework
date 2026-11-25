import type { ButtonProps } from "./types";

export default function Button({ id, label, disabled = false }: ButtonProps) {
  return (
    <button id={id} type="button" disabled={disabled}>
      {label}
    </button>
  );
}
