import { type Accessor, For, type JSX, Show, createMemo, untrack } from "solid-js";

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
  props: MenuBoardProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `menu-board ${props.class}` : "menu-board"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Show
        when={props.closed}
        fallback={
          <KeyedFor each={props.courses} by={(course) => course.id}>
            {(course) => (
              <section aria-label={course().title}>
                <h2>{course().title}</h2>
                <ul>
                  <KeyedFor each={course().dishes} by={(dish) => dish.id}>
                    {(dish) => (
                      <li>
                        {dish().name}, {dish().price.toFixed(2)}
                        <Show when={dish().vegetarian}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
