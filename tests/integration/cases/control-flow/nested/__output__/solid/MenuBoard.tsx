import {
  type ComponentProps,
  For,
  type JSX,
  Show,
  createMemo,
  splitProps,
  untrack,
} from "solid-js";

export interface MenuDish {
  id: string;
  name: string;
  price: number;
  vegetarian: boolean;
}

export interface MenuCourse {
  id: string;
  title: string;
  dishes: MenuDish[];
}

export interface MenuBoardProps {
  courses: MenuCourse[];
  closed: boolean;
}

export default function MenuBoard(
  props: MenuBoardProps &
    Omit<ComponentProps<"div">, "courses" | "closed" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["courses", "closed", "class"]);

  return (
    <div class={props.class ? `menu-board ${props.class}` : "menu-board"} {...others}>
      <Show
        when={props.closed}
        fallback={
          <KeyedFor each={props.courses} by={(course) => course.id}>
            {(course) => (
              <section aria-label={course.value.title}>
                <h2>{course.value.title}</h2>
                <ul>
                  <KeyedFor each={course.value.dishes} by={(dish) => dish.id}>
                    {(dish) => (
                      <li>
                        {dish.value.name}, {dish.value.price.toFixed(2)}
                        <Show when={dish.value.vegetarian}>
                          <span> (vegetarian)</span>
                        </Show>
                      </li>
                    )}
                  </KeyedFor>
                </ul>
              </section>
            )}
          </KeyedFor>
        }
      >
        <p>The kitchen is closed.</p>
      </Show>
    </div>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
