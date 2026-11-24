import SaveAction from "./SaveAction";
import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Toolbar(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [clicks, setClicks] = createState(0);
  let save: HTMLButtonElement | null = null;

  return (
    <div role="toolbar" aria-label="Actions" {...props}>
      <SaveAction
        ref={clearedRef(
          (element) => {
            save = element;
          },
          () => {
            save = null;
          },
        )}
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
