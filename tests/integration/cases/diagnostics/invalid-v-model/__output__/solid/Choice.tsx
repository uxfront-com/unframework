import { type JSX, createSignal } from "solid-js";

export interface ChoiceModels {
  picked?: string;
  onPickedChange?: (value: string) => void;
}

export function Choice(props: ChoiceModels & { class?: string; style?: JSX.CSSProperties }) {
  const [localPicked, setLocalPicked] = createSignal<string>("");
  const picked = () => (props.picked === undefined ? localPicked() : props.picked);

  function setPicked(next: string) {
    setLocalPicked(next);
    props.onPickedChange?.(next);
  }

  return (
    <button
      type="button"
      onClick={() => setPicked("yes")}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Yes ({picked()})
    </button>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
