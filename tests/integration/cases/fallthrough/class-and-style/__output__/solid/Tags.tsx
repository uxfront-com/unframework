import Tag from "./Tag";
import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function Tags(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [active, setActive] = createSignal(false);

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
