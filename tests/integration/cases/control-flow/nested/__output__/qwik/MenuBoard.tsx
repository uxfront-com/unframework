import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

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

export default component$<
  MenuBoardProps &
    Omit<PropsOf<"div">, "courses" | "closed" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ courses, closed, class: className, style, ...attributes }) => {
  return (
    <div class={["menu-board", className]} style={style} {...attributes}>
      {closed ? (
        <p>The kitchen is closed.</p>
      ) : (
        courses.map((course) => (
          <section key={course.id} aria-label={course.title}>
            <h2>{course.title}</h2>
            <ul>
              {course.dishes.map((dish) => (
                <li key={dish.id}>
                  {dish.name}, {dish.price.toFixed(2)}
                  {dish.vegetarian ? <span> (vegetarian)</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
});
