import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

const Countdown = component$<{ from: number } & { class?: ClassList; style?: CSSProperties }>(
  ({ from, class: className, style }) => {
    return (
      <div class={["level", className]} style={style}>
        <span>{from}</span>
        {from > 0 ? <Countdown from={from - 1} /> : <strong>Liftoff</strong>}
      </div>
    );
  },
);
export default Countdown;
