import Card from "./Card";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <div class={["cards", className]} style={style} {...attributes}>
      <Card label="Full" title$={() => <h3>Weather</h3>}>
        <p>Sunny, 21°</p>
      </Card>
      <Card label="Bare" />
    </div>
  );
});
