import Tag from "./Tag";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type TagsAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Tags({ className, style, ...attributes }: TagsAttributes) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(active);

  return (
    <div className={cx("tags", className)} style={style} {...attributes}>
      <Tag label="plain" />
      <Tag label="wide" className="wide" style={{ marginLeft: "8px" }} />
      <Tag
        label="toggled"
        className={cx("picked", { active })}
        style={{ color: active ? "rgb(200, 0, 0)" : undefined }}
      />
      <button
        type="button"
        onClick={() => {
          activeRef.current = !activeRef.current;
          setActive(activeRef.current);
        }}
      >
        Toggle
      </button>
    </div>
  );
}
