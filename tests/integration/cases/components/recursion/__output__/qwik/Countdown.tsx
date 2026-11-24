import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

const Countdown = component$<
  { from: number } & Omit<PropsOf<"div">, "from" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ from, class: className, style, ...attributes }) => {
  return (
    <div class={["level", className]} style={style} {...attributes}>
      <span>{from}</span>
      {from > 0 ? <Countdown from={from - 1} /> : <strong>Liftoff</strong>}
    </div>
  );
});
export default Countdown;
