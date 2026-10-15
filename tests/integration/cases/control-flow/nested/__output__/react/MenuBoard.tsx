import type { CSSProperties } from "react";

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

export interface MenuBoardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function MenuBoard({
  courses,
  closed,
  className,
  style,
}: MenuBoardProps & MenuBoardAttributes) {
  return (
    <div className={cx("menu-board", className)} style={style}>
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
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
