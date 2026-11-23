import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Row from "./Row.gts";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

export interface TasksSignature {
  Args: { initial: Task[] } & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

export default class Tasks extends Component<TasksSignature> {
  add = () => {
    this.tasks = [...this.tasks, { id: this.tasks.length + 1, name: "Water plants", done: false }];
  };

  finish = (id: number) => {
    this.tasks = this.tasks.map((task) => (task.id === id ? { ...task, done: true } : task));
  };

  @tracked tasks = this.args.initial;

  listener1 = () => this.finish(1);

  <template><div
      style={{fallthroughStyle @style}}
      ...attributes
    ><div
      role="list"
      aria-label="Tasks"
    >{{#each this.tasks key="id" as |task|}}<Row @name={{task.name}} @done={{task.done}} />{{/each}}</div><button
      type="button"
      {{on "click" this.add}}
    >Add a task</button><button
      type="button"
      {{on "click" this.listener1}}
    >Finish the first</button></div></template>
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
