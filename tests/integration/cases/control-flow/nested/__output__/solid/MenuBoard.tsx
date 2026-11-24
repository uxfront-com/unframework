import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";

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
