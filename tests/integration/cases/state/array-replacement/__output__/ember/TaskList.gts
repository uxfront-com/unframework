import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

export interface TaskListSignature {
  Args: TaskListProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class TaskList extends Component<TaskListSignature> {
  add = () => {
    this.added += 1;
    this.tasks = [...this.tasks, { id: `new-${this.added}`, label: `New task ${this.added}` }];
  };

  select = (id: string) => {
    this.selected = id;
  };

  remove = (id: string) => {
    this.tasks = this.tasks.filter((entry) => entry.id !== id);
  };

  moveUp = () => {
    const index = this.tasks.findIndex((entry) => entry.id === this.selected);
    const above = this.tasks[index - 1];
    const current = this.tasks[index];
    if (index > 0 && above && current) {
      this.tasks = this.tasks.toSpliced(index - 1, 2, current, above);
    }
  };

  @tracked tasks = this.args.initial;

  @tracked selected: string | undefined = undefined;

  added = 0;

  get value1() {
    return this.tasks.length === 0;
  }

  get value2() {
    return !(this.tasks.length === 0) ? this.tasks : undefined;
  }

  value3 = (task: NonNullable<this["tasks"]>[number]) => this.selected === task.id;

  listener1 = (task: NonNullable<this["tasks"]>[number]) => () => this.select(task.id);

  value4 = (task: NonNullable<this["tasks"]>[number]) => `Remove ${task.label}`;

  listener2 = (task: NonNullable<this["tasks"]>[number]) => () => this.remove(task.id);

  <template><section
      class="task-list"
      aria-label="Tasks"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if this.value1}}<p>No tasks yet.</p>{{else}}<ul>{{#each this.value2 key="id" as |task|}}<li><button
      type="button"
      aria-pressed={{enumeratedValue (this.value3 task)}}
      {{on "click" (this.listener1 task)}}
    >{{task.label}}</button><button
      type="button"
      aria-label={{this.value4 task}}
      {{on "click" (this.listener2 task)}}
    >Remove</button></li>{{/each}}</ul>{{/if}}<button
      type="button"
      {{on "click" this.add}}
    >Add task</button><button type="button" {{on "click" this.moveUp}}>Move up</button></section></template>
}

/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean"
    ? (String(value) as "true" | "false")
    : (value as Exclude<T, boolean>);
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
