// UF3018 unportable-binding: a boolean bound to a `data-*` attribute, which Qwik drops when it is
// false and the others render as "false"; write `String(active)`.
export interface ToggleProps {
  label: string;
  active: boolean;
}

export default function Toggle({ label, active }: ToggleProps) {
  return (
    <button type="button" data-active={active}>
      {label}
    </button>
  );
}
