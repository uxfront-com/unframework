import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

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

export default component$<MenuBoardProps & { class?: ClassList; style?: CSSProperties }>(
  ({ courses, closed, class: className, style, ...attributes }) => {
    return (
      <div class={["menu-board", className]} {...scopeAttributes(attributes)} style={style}>
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
