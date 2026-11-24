import Legend from "./Legend";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { series: string[] } & Omit<PropsOf<"div">, "series" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ series, class: className, style, ...attributes }) => {
  return (
    <div class={className} style={style} {...attributes}>
      <Legend
        items={series}
        label="Series"
        swatch$={({ item }) => <b>{item.slice(0, 1)}</b>}
        caption$={({ item }) => <i>{item}</i>}
      />
      <Legend
        items={series}
        label="Captions"
        caption$={({ item }) => <span>{item.toUpperCase()}</span>}
      />
    </div>
  );
});
