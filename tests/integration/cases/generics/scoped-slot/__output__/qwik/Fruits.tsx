import Picker from "./Picker";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

interface Fruit {
  name: string;
  count: number;
}

export default component$<
  { fruits: Fruit[] } & Omit<PropsOf<"ul">, "fruits" | "class" | "style" | "items" | "item$"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ fruits, class: className, style, ...attributes }) => {
  return (
    <>
      <Picker
        items={fruits}
        item$={({ item }) => (
          <span>
            {item.name} × {item.count}
          </span>
        )}
        class={className}
        style={style}
        {...attributes}
      />
    </>
  );
});
