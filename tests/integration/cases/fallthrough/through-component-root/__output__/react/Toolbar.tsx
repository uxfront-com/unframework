import SaveAction from "./SaveAction";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type ToolbarAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Toolbar({ className, style, ...attributes }: ToolbarAttributes) {
  const [clicks, setClicks] = useState(0);
  const clicksRef = useRef(clicks);
  const save = useRef<HTMLButtonElement>(null);

  return (
    <div role="toolbar" aria-label="Actions" className={className} style={style} {...attributes}>
      <SaveAction
        ref={save}
        text="Save"
        id="save"
        aria-label="Save draft"
        onClick={() => {
          clicksRef.current++;
          setClicks(clicksRef.current);
        }}
      />
      <button type="button" onClick={() => save.current?.focus()}>
        Focus save
      </button>
      <p>Clicks: {clicks}</p>
    </div>
  );
}
