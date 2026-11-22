import SaveButton from "./SaveButton";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function Editor(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [pressed, setPressed] = createSignal(false);

  return (
    <div class={props.class ? `editor ${props.class}` : "editor"} {...others}>
      <p id="save-hint">Saves the draft.</p>
      <SaveButton
        title="Save"
        id="save"
        aria-describedby="save-hint"
        aria-pressed={pressed()}
        data-testid="save-button"
        type="submit"
        class="primary"
      />
      <button type="button" onClick={() => setPressed(!pressed())}>
        Toggle
      </button>
    </div>
  );
}
