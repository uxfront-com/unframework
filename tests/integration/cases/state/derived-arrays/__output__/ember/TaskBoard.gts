import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";

export interface Task {
  id: number;
  title: string;
  kind: string;
  rank: number;
  done: boolean;
}

export interface Filters {
  query: string;
  tags: string[];
}

export interface TaskBoardProps {
  initial: Task[];
}

export interface TaskBoardSignature {
  Args: TaskBoardProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class TaskBoard extends Component<TaskBoardSignature> {
  finish = (id: number) => {
    this.tasks = this.tasks.map((task) => (task.id === id ? { ...task, done: true } : task));
  };

  addTag = (tag: string) => {
    const next = { ...this.filters, tags: [...this.filters.tags] };
    next.tags.push(tag);
    this.filters = next;
  };

  resize = () => {
    const field = this.notes;
    if (!field) return;
    const lines = field.value.split("\n").length;
    field.style.height = `${Math.max(lines, 2) * 1.5}em`;
    field.classList.toggle("tall", lines > 3);
  };

  sizeSummary = (event: Event) => {
    const area = event.currentTarget as HTMLTextAreaElement;
    const lines = area.value.split("\n").length;
    area.style.height = `${Math.max(lines, 2) * 1.5}em`;
    area.classList.toggle("tall", lines > 3);
  };

  @tracked tasks = this.args.initial;

  @tracked filters: Filters = { query: "", tags: [] };

  @tracked notes: HTMLTextAreaElement | null = null;

  get open() {
    return this.tasks.filter((task) => !task.done).sort((a, b) => a.rank - b.rank);
  }

  get alphabetical() {
    return this.tasks.slice().sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  }

  get newestFirst() {
    return this.tasks.map((task) => task.title).reverse();
  }

  get kinds() {
    const byKind: Record<string, Task[]> = {};
    for (const task of this.tasks) {
      if (!byKind[task.kind]) byKind[task.kind] = [];
      byKind[task.kind]!.push(task);
    }
    return Object.keys(byKind).map((kind) => `${kind}: ${byKind[kind]!.length}`);
  }

  get byId() {
    return this.tasks.reduce<Record<number, Task>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {});
  }

  get titlesByKind() {
    return this.tasks.reduce<Record<string, string[]>>((acc, task) => {
      (acc[task.kind] ||= []).push(task.title);
      return acc;
    }, {});
  }

  get finishedByKind() {
    return this.tasks.reduce((acc, task) => {
      if (task.done) acc.set(task.kind, (acc.get(task.kind) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  }

  get byState() {
    const groups: Record<string, string[]> = {};
    for (const task of this.tasks) {
      const state = task.done ? "done" : "open";
      groups[state] ??= [];
      groups[state]!.push(task.title);
    }
    return groups;
  }

  get progress() {
    return Math.round((this.tasks.filter((task) => task.done).length / this.tasks.length) * 100);
  }

  value1 = (task: NonNullable<this["open"]>[number]) => `Finish ${task.title}`;

  listener1 = (task: NonNullable<this["open"]>[number]) => () => this.finish(task.id);

  value2 = (task: NonNullable<this["open"]>[number]) => classNames(task.rank === 1 && "first");

  get value3() {
    return styleText([["width", `${this.progress}%`]]);
  }

  get value4() {
    return this.alphabetical.map((task) => task.title).join(", ");
  }

  get value5() {
    return this.newestFirst.join(", ");
  }

  get value6() {
    return this.byId[2]?.title;
  }

  get value7() {
    return this.titlesByKind["code"]?.join(", ");
  }

  get value8() {
    return this.finishedByKind.get("code") ?? 0;
  }

  get value9() {
    return this.byState["done"]?.join(", ") ?? "nothing";
  }

  listener2 = () => this.addTag("urgent");

  listener3 = () => this.addTag("later");

  get value10() {
    return this.filters.tags.join(", ");
  }

  <template><section
      class="task-board"
      aria-label="Tasks"
      style={{fallthroughStyle @style}}
      ...attributes
    ><ol
      aria-label="Open"
    >{{#each this.open key="id" as |task|}}<li
      class={{this.value2 task}}
    >{{task.title}}<button
      type="button"
      {{on "click" (this.listener1 task)}}
    >{{this.value1 task}}</button></li>{{/each}}</ol><div
      class="meter"
      role="presentation"
    ><div class="fill" style={{this.value3}}></div></div><p>Alphabetical: {{this.value4}}</p><p>Newest first: {{this.value5}}</p><ul
      aria-label="Kinds"
    >{{#each this.kinds key="@identity" as |line|}}<li>{{line}}</li>{{/each}}</ul><p>Task 2: {{this.value6}}</p><p>Code tasks: {{this.value7}}</p><p>Finished code tasks: {{this.value8}}</p><p>Done: {{this.value9}}</p><button
      type="button"
      {{on "click" this.listener2}}
    >Tag urgent</button><button type="button" {{on "click" this.listener3}}>Tag later</button><p>Tags: {{this.value10}}</p><label>Notes<textarea
      {{templateRef this "notes"}}
      name="notes"
      class="notes"
      {{on "input" this.resize}}
    ></textarea></label><label>Summary<textarea
      name="summary"
      class="summary"
      {{on "input" this.sizeSummary}}
    ></textarea></label></section></template>
}

/** A class as clsx builds it: strings, arrays and toggle objects, empty tokens left out. */
function classNames(...values: unknown[]): string | undefined {
  const tokens: string[] = [];
  const add = (value: unknown): void => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") tokens.push(String(value));
    else if (Array.isArray(value)) for (const each of value) add(each);
    else if (typeof value === "object") {
      for (const [name, on] of Object.entries(value)) if (on) tokens.push(name);
    }
  };
  for (const value of values) add(value);
  return tokens.length ? tokens.join(" ") : undefined;
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

/**
 * A style from its declarations, those whose value is nullish left out, marked safe. A
 * declaration without a property is a whole style: a declaration list, or an object whose keys
 * may be in camel case, as Vue's `normalizeStyle` reads them.
 */
function styleText(
  declarations: readonly (readonly [string, unknown])[],
): ReturnType<typeof htmlSafe> | undefined {
  const parts: string[] = [];
  const add = (property: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    if (property) parts.push(`${property}: ${String(value)}`);
    else if (typeof value === "string") parts.push(value.trim().replace(/;$/, ""));
    else if (typeof value === "object") {
      for (const [key, each] of Object.entries(value)) {
        add(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          each,
        );
      }
    }
  };
  for (const [property, value] of declarations) add(property, value);
  const text = parts.filter(Boolean).join("; ");
  return text ? htmlSafe(text) : undefined;
}

/** A modifier that sets a member of its component to its element while the element is rendered. */
const templateRef = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: () => ({}),
    installModifier(
      _state: object,
      element: Element,
      { positional }: { positional: readonly unknown[] },
    ) {
      Reflect.set(positional[0] as object, positional[1] as string, element);
    },
    updateModifier() {},
    destroyModifier(_state: object, { positional }: { positional: readonly unknown[] }) {
      Reflect.set(positional[0] as object, positional[1] as string, null);
    },
  }),
  {},
) as unknown as ModifierLike<{
  Element: Element;
  Args: { Positional: [owner: object, name: string] };
}>;
