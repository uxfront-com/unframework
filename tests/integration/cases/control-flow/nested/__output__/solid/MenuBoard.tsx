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
    <div class={props.class ? `menu-board ${props.class}` : "menu-board"} style={props.style}>
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
