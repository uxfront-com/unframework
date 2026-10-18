import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

const KeepAlive = component$<{ level: number } & { class?: ClassList; style?: CSSProperties }>(
  ({ level, class: className, style }) => {
    return (
      <div class={["level", className]} style={style}>
        <span>Level {level}</span>
        {level > 0 ? <KeepAlive level={level - 1} /> : null}
      </div>
    );
  },
);
export default KeepAlive;
