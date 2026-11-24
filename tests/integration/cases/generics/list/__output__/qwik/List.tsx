import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export default component$(
  <T,>({
    label,
    items,
    selected,
    class: className,
    style,
    ...attributes
  }: ListProps<T> &
    Omit<PropsOf<"ul">, "label" | "items" | "selected" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }) => {
    return (
      <ul aria-label={label} class={className} style={style} {...attributes}>
        {items.map((item, index) => (
          <li key={index} aria-current={item === selected ? "true" : undefined}>
            {String(item)}
          </li>
        ))}
      </ul>
    );
  },
);
