import Tag from "./Tag";
import { createState } from "./_unframework/createState";
import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Tags(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [active, setActive] = createState(false);

  return (
    <div class={props.class ? `tags ${props.class}` : "tags"} {...others}>
      <Tag label="plain" />
      <Tag label="wide" class="wide" style={{ "margin-left": "8px" }} />
      <Tag
        label="toggled"
        class={cx("picked", { active: active() })}
        style={{ color: active() ? "rgb(200, 0, 0)" : undefined }}
      />
      <button type="button" onClick={() => setActive(!active())}>
        Toggle
      </button>
    </div>
  );
}
