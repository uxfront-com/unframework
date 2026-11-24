import SaveButton from "./SaveButton";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Editor(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [pressed, setPressed] = createState(false);

  return (
    <div class={props.class ? `editor ${props.class}` : "editor"} {...others}>
      <p id="save-hint">Saves the draft.</p>
      <SaveButton
        title="Save"
        id="save"
        aria-describedby="save-hint"
        aria-pressed={enumeratedValue(pressed())}
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
