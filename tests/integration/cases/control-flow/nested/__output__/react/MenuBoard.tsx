import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: MenuBoardProps & MenuBoardAttributes) {
  return (
    <div className={cx("menu-board", className)} style={style} {...scopeAttributes(attributes)}>
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
