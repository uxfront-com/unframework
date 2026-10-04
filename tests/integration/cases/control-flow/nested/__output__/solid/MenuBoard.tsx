import { For, Show } from "solid-js";

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

export default function MenuBoard(props: MenuBoardProps) {
  return (
    <div class="menu-board">
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
