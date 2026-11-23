import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

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

export interface MenuBoardSignature {
  Args: MenuBoardProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

export default class MenuBoard extends Component<MenuBoardSignature> {
  value1 = (dish: NonNullable<NonNullable<this["args"]["courses"]>[number]["dishes"]>[number]) =>
    dish.price.toFixed(2);

  <template><div
      class="menu-board"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if @closed}}<p>The kitchen is closed.</p>{{else}}{{#each @courses key="id" as |course|}}<section
      aria-label={{course.title}}
    ><h2>{{course.title}}</h2><ul>{{#each course.dishes key="id" as |dish|}}<li>{{dish.name}}, {{this.value1 dish}}{{#if dish.vegetarian}}<span> (vegetarian)</span>{{/if}}</li>{{/each}}</ul></section>{{/each}}{{/if}}</div></template>
}

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}
