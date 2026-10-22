import { For, type JSX, Show } from "solid-js";

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
          <For each={props.courses}>
            {(course) => (
              <section aria-label={course.title}>
                <h2>{course.title}</h2>
                <ul>
                  <For each={course.dishes}>
                    {(dish) => (
                      <li>
                        {dish.name}, {dish.price.toFixed(2)}
                        <Show when={dish.vegetarian}>
                          <span> (vegetarian)</span>
                        </Show>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </For>
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
