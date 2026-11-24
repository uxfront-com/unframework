import SaveButton from "./SaveButton";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type EditorAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Editor({ className, style, ...attributes }: EditorAttributes) {
  const [pressed, setPressed] = useState(false);
  const pressedRef = useRef(pressed);

  return (
    <div className={cx("editor", className)} style={style} {...attributes}>
      <p id="save-hint">Saves the draft.</p>
      <SaveButton
        title="Save"
        className="primary"
        id="save"
        aria-describedby="save-hint"
        aria-pressed={pressed}
        data-testid="save-button"
        type="submit"
      />
      <button
        type="button"
        onClick={() => {
          pressedRef.current = !pressedRef.current;
          setPressed(pressedRef.current);
        }}
      >
        Toggle
      </button>
    </div>
  );
}
