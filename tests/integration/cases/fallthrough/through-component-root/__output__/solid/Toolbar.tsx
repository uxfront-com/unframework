import SaveAction from "./SaveAction";
import { type ComponentProps, type JSX, createSignal, onCleanup } from "solid-js";

export default function Toolbar(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  const [clicks, setClicks] = createSignal(0);
  let save: HTMLButtonElement | null = null;

  return (
    <div role="toolbar" aria-label="Actions" {...props}>
      <SaveAction
        ref={(element) => {
          save = element;
          onCleanup(() => {
            save = null;
          });
        }}
        text="Save"
        id="save"
        aria-label="Save draft"
        onClick={() => setClicks(clicks() + 1)}
      />
      <button type="button" onClick={() => save?.focus()}>
        Focus save
      </button>
      <p>Clicks: {clicks()}</p>
    </div>
  );
}
