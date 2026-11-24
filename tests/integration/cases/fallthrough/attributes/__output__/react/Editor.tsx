import SaveButton from "./SaveButton";
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
