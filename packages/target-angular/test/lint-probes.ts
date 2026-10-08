// What this target emits for M1's constructs, in the shapes of plan §6 as the emitter prints
// them: signal inputs (`input.required`, `input` with a default and a transform), one `@let` per
// input the template reads (`this.label()`), `@if`/`@else if`/`@else`, `@for` with `track` (a prop
// read there from its input) and `let index = $index`, a static `class` and `style` beside
// `[class]` and `[style.x]`, `[attr.x]` bindings, globals as protected members. The same three
// components on every target: a badge (props with defaults, a conditional chain, class and style
// bindings, bound attributes, SVG), a list (nested keyed lists, conditionals inside and around
// them, a root fragment) and a card (the `props` form, a typed spread written out key by key, a
// static style). lint.test.ts pins the L5 configuration against them (ADR-0042): a rule that
// rejects one of them would force an emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "badge.ts": `import { Component, input } from "@angular/core";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

@Component({
  selector: "uf-badge",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: \`
    @let label = this.label();
    @let tone = this.tone();
    @let count = this.count();
    @let pill = this.pill();
    @let gap = this.gap();
    @let quiet = this.quiet();
    <span
      id="badge"
      class="badge"
      [class]="[pill ? 'pill' : null, 'tone-' + tone].join(' ')"
      style="color: red"
      [style.line-height]="1.5"
      [style.margin-top]="gap"
      [style.--gap]="gap"
      [attr.aria-hidden]="quiet"
      [attr.data-tone]="tone"
      [attr.title]="label"
    >
      @if (count !== undefined && count > 0) {
        <strong>{{ Math.min(count, 99) }}</strong>
      } @else if (tone === 'warn') {
        !
      }
      {{ label }}
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <title>Icon</title>
        <circle cx="8" cy="8" r="4" stroke-width="2" />
        <path d="M0 0h16" />
      </svg>
      <input
        id="count"
        type="number"
        [attr.disabled]="quiet ? '' : null"
        tabindex="0"
        maxlength="10"
        readonly
      />
      <label for="count">Count</label>
    </span>
  \`,
})
export default class Badge {
  readonly label = input.required<string>();
  readonly tone = input<"info" | "warn", "info" | "warn" | undefined>("info", {
    transform: (value) => (value === undefined ? "info" : value),
  });
  readonly count = input<number>();
  readonly pill = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly gap = input<string>();
  readonly quiet = input<boolean>();
  protected readonly Math = Math;
}
`,
  "link-card.ts": `import { Component, input } from "@angular/core";

interface LinkAttrs {
  href: string;
  title?: string;
  class?: string;
}

export interface LinkCardProps {
  label: string;
  link: LinkAttrs;
  extra?: { id?: string; role?: string };
  accent?: string;
}

@Component({
  selector: "uf-link-card",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: \`
    @let label = this.label();
    @let link = this.link();
    @let extra = this.extra();
    @let accent = this.accent();
    <div class="card" [class]="accent" style="padding: 4px; border: 1px solid">
      <a
        [attr.href]="link.href"
        [attr.title]="link.title"
        class="card-link"
        [class]="link.class"
      >{{ label }}</a>
      <p [attr.id]="extra?.id" [attr.role]="extra?.role">More</p>
    </div>
  \`,
})
export default class LinkCard {
  readonly label = input.required<string>();
  readonly link = input.required<LinkAttrs>();
  readonly extra = input<{ id?: string; role?: string }>();
  readonly accent = input<string>();
}
`,
  "todo-list.ts": `import { Component, input } from "@angular/core";

interface Todo {
  id: string;
  title: string;
  done?: boolean;
  tags: string[];
}

export interface TodoListProps {
  todos: Todo[];
  heading?: string;
  prefix: string;
}

@Component({
  selector: "uf-todo-list",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: \`
    @let todos = this.todos();
    @let heading = this.heading();
    @if (heading) {
      <h2>{{ heading }}</h2>
    }
    @if (todos.length > 0) {
      <ol class="todos">
        @for (todo of todos; track this.prefix() + todo.id; let index = $index) {
          <li [class]="{ done: todo.done }">
            {{ index + 1 }}. {{ todo.title }}
            @if (todo.tags.length > 0) {
              <ul>
                @for (tag of todo.tags; track tag) {
                  <li>{{ tag }}</li>
                }
              </ul>
            }
          </li>
        }
      </ol>
    } @else {
      <p>Nothing to do.</p>
    }
  \`,
})
export default class TodoList {
  readonly todos = input.required<Todo[]>();
  readonly heading = input<string>();
  readonly prefix = input.required<string>();
}
`,
};

// The shapes M2 emits (ADR-0045 to ADR-0049), as sources: what the corpus does not show on its own
// (a constant read once, a `let` assigned later, a handler that returns a value, `||`, `?:` and
// async inline handlers, listener options in conditionals and lists, watchers of every source
// kind with and without `immediate`, `flush: "post"` and `onCleanup`, `watchEffect` with a
// cleanup, an async `onMounted` awaiting `nextTick()`, `onUnmounted`, ids, a function passed as a
// value), and shapes this target once got wrong (async watch callbacks and `watchEffect`, setup
// `let`s seeded from inputs and the types of their initial values, listeners of one event that run
// in attribute order beside an option, in a list over any array, in a narrowed branch and beside
// a handler's own `event`, calls and moved handlers whose value a template statement must drop, a
// state read only in a list handler's arguments, tuples of an array source annotated or not, a
// function passed as a value that an initial value calls, `nextTick` before the next event of one
// key, events named after JavaScript keywords). output.test.ts holds their output to L3 and L4,
// lint.test.ts to L5, setup.test.ts to its text, and the browser tests run them
// (`virtual:uf-angular/probe/<Name>`).

/** File name → source. */
export const M2_SOURCES: Readonly<Record<string, string>> = {
  "Seeded.uf.tsx": `import { computed, ref } from "unframework";

export interface SeededProps {
  start: number;
  unit?: string;
}

export default function Seeded({ start, unit = "kg" }: SeededProps) {
  const factor = 2;
  const label = \`\${start} \${unit}\`;
  const amount = ref(start * factor);
  const picked = ref<string>();
  const total = computed<number>(() => amount.value + start);
  const summary = computed(() => \`\${label}: \${total.value}\`);
  let clicks = 0;
  let last: number | undefined;

  function add() {
    clicks += 1;
    last = amount.value;
    amount.value += factor;
    picked.value = \`\${clicks} after \${last}\`;
  }

  return (
    <section aria-label="Seeded">
      <p>{summary.value}</p>
      <p>{picked.value ?? "none"}</p>
      <button type="button" onClick={add}>
        Add
      </button>
    </section>
  );
}
`,
  "Handlers.uf.tsx": `import { defineEmits, ref } from "unframework";

export interface Item {
  id: string;
  name: string;
}

export interface HandlersProps {
  items: Item[];
  owner?: Item;
}

export default function Handlers({ items, owner }: HandlersProps) {
  const emit = defineEmits<{ pick: [id: string, at: number]; cleared: [] }>();

  const last = ref("none");
  const busy = ref(false);

  function remember(event: KeyboardEvent) {
    last.value = event.key;
  }

  function toggle() {
    busy.value = !busy.value;
    return busy.value;
  }

  function reset() {
    last.value = "idle";
  }

  function clear() {
    emit("cleared");
  }

  function choose(item: Item, at: number, event: MouseEvent) {
    last.value = \`\${item.name} \${event.type}\`;
    emit("pick", item.id, at);
  }

  return (
    <div>
      <input aria-label="Key" onKeydown={remember} />
      <button type="button" onClick={toggle}>
        Toggle
      </button>
      <ul>
        {items.map((item, index) => (
          <li key={item.id}>
            <button type="button" onClick={(event) => choose(item, index, event)}>
              {item.name}
            </button>
          </li>
        ))}
      </ul>
      {owner && (
        <button type="button" onClick={() => emit("pick", owner.id, -1)}>
          Owner
        </button>
      )}
      <button type="button" onClick={() => emit("cleared")}>
        Clear all
      </button>
      <button type="button" onClick={() => busy.value || reset()}>
        Settle
      </button>
      <button type="button" onClick={() => (busy.value ? clear() : reset())}>
        Check
      </button>
      <button
        type="button"
        onClick={async () => {
          busy.value = true;
          await Promise.resolve();
          busy.value = false;
        }}
      >
        Wait
      </button>
      <input aria-label="Name" onInput={(event) => (last.value = (event.currentTarget as HTMLInputElement).value)} />
      <p role="status">{last.value}</p>
    </div>
  );
}
`,
  "Options.uf.tsx": `import { ref } from "unframework";

export interface OptionsProps {
  rows: string[];
  open: boolean;
}

export default function Options({ rows, open }: OptionsProps) {
  const seen = ref<string[]>([]);

  function note(line: string) {
    seen.value = [...seen.value, line];
  }

  return (
    <div role="presentation" onClickCapture={() => note("capture")}>
      {open && (
        <button type="button" onClickOnce={() => note("once")}>
          Once
        </button>
      )}
      <ul>
        {rows.map((row) => (
          <li key={row}>
            <button type="button" onClickOnce={() => note(row)}>
              {row}
            </button>
          </li>
        ))}
      </ul>
      <div role="group" aria-label="Scroll" onTouchstartPassive={() => note("touch")}>
        <p>{seen.value.length}</p>
      </div>
    </div>
  );
}
`,
  "Watchers.uf.tsx": `import { computed, defineEmits, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch, watchEffect } from "unframework";

export interface WatchersProps {
  size: number;
}

export default function Watchers({ size }: WatchersProps) {
  const emit = defineEmits<{
    moved: [value: number, previous?: number];
    sized: [size: number];
    pair: [first: number, second: string];
    measured: [height: number];
    left: [];
  }>();

  const count = ref(0);
  const name = ref("a");
  const double = computed(() => count.value * 2);
  const box = useTemplateRef<HTMLDivElement>();

  watch(count, (value, previous) => {
    emit("moved", value, previous);
  });

  watch(double, (value) => {
    emit("sized", value);
  });

  watch(
    () => size,
    (value, previous) => {
      emit("moved", value, previous);
    },
    { immediate: true },
  );

  watch([count, name], ([first, second], previous, onCleanup) => {
    emit("pair", first, second);
    onCleanup(() => {
      emit("left");
    });
  });

  watch(
    () => {
      const sum = count.value + size;
      return sum > 3;
    },
    (big) => {
      emit("sized", big ? 1 : 0);
    },
  );

  watch(
    count,
    (value, previous, onCleanup) => {
      emit("measured", box.value?.childElementCount ?? 0);
      onCleanup(() => emit("left"));
    },
    { flush: "post" },
  );

  watchEffect(() => {
    emit("sized", size + count.value);
  });

  watchEffect((onCleanup) => {
    const current = name.value;
    onCleanup(() => {
      emit("pair", 0, current);
    });
  });

  onMounted(async () => {
    count.value = 1;
    await nextTick();
    emit("measured", box.value?.childElementCount ?? 0);
  });

  onUnmounted(() => {
    emit("left");
  });

  return (
    <div ref={box}>
      <p>{count.value}</p>
      <button type="button" onClick={() => count.value++}>
        More
      </button>
      <button type="button" onClick={() => (name.value = name.value + "b")}>
        Longer
      </button>
    </div>
  );
}
`,
  "Ids.uf.tsx": `import { defineEmits, onMounted, useId } from "unframework";

export default function Ids() {
  const emit = defineEmits<{ ticked: [count: number] }>();
  const fieldId = useId();
  const hintId = useId();
  let ticks = 0;

  function tick() {
    ticks += 1;
    emit("ticked", ticks);
  }

  onMounted(() => {
    setTimeout(tick, 10);
  });

  return (
    <p>
      <label for={fieldId}>Name</label>
      <input id={fieldId} aria-describedby={hintId} />
      <span id={hintId}>Hint</span>
    </p>
  );
}
`,
  "Sorter.uf.tsx": `import { ref } from "unframework";

export default function Sorter() {
  const names = ref(["Cy", "Al"].toSorted((a, b) => compare(a, b)));

  function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function add(name: string) {
    names.value = [...names.value, name].toSorted(compare);
  }

  return (
    <div>
      <p>{names.value.join(", ")}</p>
      <button type="button" onClick={() => add("Bo")}>
        Add
      </button>
    </div>
  );
}
`,
  "InlineEditor.uf.tsx": `import { defineEmits, nextTick, ref, useTemplateRef } from "unframework";

export default function InlineEditor() {
  const emit = defineEmits<{ focused: [label: string]; renamed: [name: string] }>();
  const editing = ref(false);
  const name = ref("Draft");
  const field = useTemplateRef<HTMLInputElement>();
  const edit = useTemplateRef<HTMLButtonElement>();

  async function startEditing() {
    editing.value = true;
    await nextTick();
    field.value?.focus();
    field.value?.select();
    emit("focused", document.activeElement?.getAttribute("aria-label") ?? "none");
  }

  async function commit(event: KeyboardEvent) {
    if (event.key !== "Enter") {
      return;
    }
    name.value = (event.currentTarget as HTMLInputElement).value;
    editing.value = false;
    emit("renamed", name.value);
    await nextTick();
    edit.value?.focus();
    emit("focused", document.activeElement?.textContent ?? "none");
  }

  return (
    <div>
      {editing.value ? <input ref={field} aria-label="Name" onKeydown={commit} /> : <p>{name.value}</p>}
      <button ref={edit} type="button" onClick={startEditing}>
        Rename
      </button>
    </div>
  );
}
`,
  "AsyncEffects.uf.tsx": `import { defineEmits, ref, watch, watchEffect } from "unframework";

export interface AsyncEffectsProps {
  id: number;
}

export default function AsyncEffects({ id }: AsyncEffectsProps) {
  const emit = defineEmits<{ loaded: [text: string]; saved: [value: number]; seen: [value: number] }>();
  const name = ref("");
  const count = ref(0);

  watch(
    () => id,
    async (value) => {
      const text = await Promise.resolve(\`User \${value}\`);
      name.value = text;
      emit("loaded", text);
    },
  );

  watch(count, async (value) => {
    await Promise.resolve();
    emit("saved", value);
  });

  watchEffect(async () => {
    const current = count.value;
    await Promise.resolve();
    emit("seen", current);
  });

  return (
    <div>
      <p>{name.value}</p>
      <button type="button" onClick={() => count.value++}>
        Add
      </button>
    </div>
  );
}
`,
  "SeededLets.uf.tsx": `import { computed, defineEmits, ref } from "unframework";

export interface SeededLetsProps {
  limit: number;
  label?: string;
  start?: number;
  note?: string;
}

export default function SeededLets({ limit, label = "Vote", start = 0, note }: SeededLetsProps) {
  const emit = defineEmits<{ voted: [remaining: number, text: string, base: number, twice: number] }>();
  const count = ref(start);
  const double = computed(() => count.value * 2);
  let remaining = limit;
  let text = \`\${label} (\${limit})\`;
  let base: number = count.value;
  let twice = double.value;
  let hint = note;
  let plain = 1;
  let found = [label].find((word) => word.length > limit);
  let tally: Record<string, unknown> = { limit };
  let size = label.length * 2;
  let fallback = note ?? "none";

  function vote() {
    if (remaining > 0) remaining -= 1;
    count.value++;
    plain += 1;
    tally = { ...tally, votes: count.value };
    const extra = \`\${found ? "!" : ""} \${Object.keys(tally).length} \${size} \${fallback}\`;
    emit("voted", remaining, \`\${text} \${hint ?? "-"}\${extra}\`, base, twice + plain);
  }

  return (
    <button type="button" onClick={vote}>
      {label}
    </button>
  );
}
`,
  "SeededTypes.uf.tsx": `import { defineEmits } from "unframework";

type Mode = "list" | "grid";

export interface SeededTypesProps {
  title: string;
  items: string[];
  note?: string;
  step?: number;
  mode?: Mode | null;
  ratio: number | null;
}

export default function SeededTypes({ title, items, note, step = 1, mode, ratio }: SeededTypesProps) {
  const emit = defineEmits<{ saved: [text: string] }>();
  let size = items.length;
  let label = title.trim().toUpperCase();
  let text = note ?? "none";
  let next = step * 2 - 1;
  let sum = step + 1;
  let joined = title + step;
  let pick = step > 1 ? "many" : "one";
  let either = step > 1 ? title : step;
  let first = items[0];
  let copy = [...items];
  let sorted = items.toSorted();
  let max = Math.max(step, 3);
  let words = title.split(" ");
  let has = items.includes(title);
  let shown = mode ?? "list";
  let factor = ratio ?? 1;
  let fixed = step.toFixed(1);
  let flag = !note;
  let negative = -step;
  let firstOr = items[0] || "empty";
  let typed = title as string;

  function save() {
    size += 1;
    label = label.toLowerCase();
    text = \`\${text}.\`;
    next += 1;
    sum += 1;
    joined += "x";
    pick = "other";
    either = either === 1 ? "x" : 2;
    first = undefined;
    copy = [...copy, "z"];
    sorted = [];
    max += 1;
    words = [...words, "w"];
    has = !has;
    shown = shown === "list" ? "grid" : "list";
    factor *= 2;
    fixed = "1";
    flag = false;
    negative -= 1;
    firstOr = "other";
    typed = typed.repeat(2);
    emit(
      "saved",
      [size, label, text, next, sum, joined, pick, either, first ?? "-", copy.length, sorted.length, max, words.length, has, shown, factor, fixed, flag, negative, firstOr, typed].join(" "),
    );
  }

  return (
    <button type="button" onClick={save}>
      Save
    </button>
  );
}
`,
  "ListenerOrder.uf.tsx": `import { defineEmits, ref } from "unframework";

export interface ListenerOrderProps {
  rows: string[];
}

export default function ListenerOrder({ rows }: ListenerOrderProps) {
  const emit = defineEmits<{ started: [count: number] }>();
  const log = ref<string[]>([]);
  const count = ref(0);
  const volume = ref(0);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function bump() {
    count.value++;
  }

  function changeVolume(event: WheelEvent) {
    volume.value += event.deltaY < 0 ? 1 : -1;
  }

  return (
    <section aria-label="Listener order">
      <div role="presentation" onClick={() => record("outer bubble")} onClickCapture={() => record("outer capture")}>
        <button
          type="button"
          onClick={() => record("plain")}
          onClickOnce={() => {
            record("once");
          }}
          onClickCapture={() => record("own capture")}
        >
          Press
        </button>
        <button
          type="button"
          onClickOnce={() => {
            record("first only");
          }}
          onClick={() => record("every time")}
        >
          Twice
        </button>
        <button type="button" onClick={bump} onClickOnce={() => emit("started", count.value)}>
          Go
        </button>
        <button
          type="button"
          onClickOnce={(e) => {
            const kind = e.type;
            record(kind);
          }}
          onClick={() => (count.value += 10)}
        >
          Jump
        </button>
        <button
          type="button"
          onClickOnce={async () => {
            await Promise.resolve();
            record("later");
          }}
          onClick={() => record("now")}
        >
          Wait
        </button>
      </div>
      <div
        role="group"
        aria-label="Volume"
        onWheel={changeVolume}
        onWheelPassive={() => record("passive wheel")}
        onWheelOnce={() => record("first wheel")}
      >
        <output>{volume.value}</output>
      </div>
      <ul>
        {rows.map((row, index) => (
          <li key={row}>
            <button type="button" onClick={() => record(row)} onClickOnce={(event) => record(\`\${row} \${index} \${event.type}\`)}>
              {row}
            </button>
          </li>
        ))}
      </ul>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
      <p>{count.value}</p>
    </section>
  );
}
`,
  "ListenerPairs.uf.tsx": `import { computed, defineEmits, ref } from "unframework";

interface Entry {
  id: number;
  title: string;
  done: boolean;
}

export interface ListenerPairsProps {
  entries: Entry[];
  data: { rows: Entry[] };
  owner?: { name: string; tags: string[] };
}

export default function ListenerPairs({ entries, data, owner }: ListenerPairsProps) {
  const emit = defineEmits<{ track: [name: string, count: number]; first: [name: string] }>();
  const log = ref<string[]>([]);
  const count = ref(0);
  const open = computed(() => entries.filter((entry) => !entry.done));
  const tags = ref(["red", "blue"]);
  const kinds = ref(["click", "keydown"]);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  async function save(line: string) {
    await Promise.resolve();
    record(\`saved \${line}\`);
  }

  function keep(next: string[]) {
    kinds.value = next;
  }

  function greet(person: { name: string; tags: string[] }) {
    record(\`greet \${person.name} \${person.tags.length}\`);
  }

  return (
    <section aria-label="Pairs">
      <ul aria-label="Open">
        {open.value.map((entry) => (
          <li key={entry.id}>
            <button type="button" onClick={() => record(entry.title)} onClickOnce={() => record(\`first \${entry.title}\`)}>
              {entry.title}
            </button>
          </li>
        ))}
      </ul>
      <ul aria-label="Rows">
        {data.rows.map((event) => (
          <li key={event.id}>
            <button type="button" onClick={() => record(\`row \${event.title}\`)} onClickOnce={async () => save(event.title)}>
              {\`Row \${event.title}\`}
            </button>
          </li>
        ))}
      </ul>
      <ul aria-label="Tags">
        {tags.value.map((tag) => (
          <li key={tag}>
            <button type="button" onClick={() => record(tag)} onClickOnce={() => emit("first", tag)}>
              {tag}
            </button>
          </li>
        ))}
      </ul>
      {owner ? (
        <div>
          <button type="button" onClick={() => record(owner.name)} onClickOnce={() => emit("first", owner.name)}>
            Owner
          </button>
          <button type="button" onClick={() => record(\`hello \${owner.name.toUpperCase()}\`)}>
            Hello
          </button>
          <button type="button" onClick={() => greet({ ...owner, name: owner.name.toUpperCase() })}>
            Shout
          </button>
          <button type="button" onClick={() => keep([...owner.tags, "new"])}>
            Tag
          </button>
        </div>
      ) : (
        <p>No owner</p>
      )}
      <button
        type="button"
        onClick={() => (count.value += 1)}
        onClickOnce={() => {
          const event = "first-click";
          emit("track", event, count.value);
        }}
      >
        Count
      </button>
      <button
        type="button"
        onClick={(event) => record(event.type)}
        onClickOnce={(e) => keep(kinds.value.filter((event) => event !== e.type))}
      >
        Kinds
      </button>
      <p>{kinds.value.join(" ")}</p>
      <ol aria-label="Log">
        {log.value.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
`,
  "Deleting.uf.tsx": `import { defineEmits } from "unframework";

export interface DeletingProps {
  ids: number[];
}

export default function Deleting({ ids }: DeletingProps) {
  const emit = defineEmits<{ delete: [id: number]; export: [id: number]; continue: []; new: []; default: [] }>();

  function remove(id: number) {
    emit("delete", id);
  }

  return (
    <ul>
      {ids.map((id) => (
        <li key={id}>
          <button type="button" onClick={() => emit("delete", id)}>
            Delete {id}
          </button>
          <button type="button" onClick={() => emit("export", id)}>
            Export {id}
          </button>
          <button type="button" onClick={() => remove(id)}>
            Remove {id}
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={() => emit("continue")}>
          Continue
        </button>
        <button type="button" onClick={() => emit("new")}>
          New
        </button>
        <button type="button" onClick={() => { emit("default"); emit("new"); }}>
          Both
        </button>
      </li>
    </ul>
  );
}
`,
  "Shadowed.uf.tsx": `import { ref } from "unframework";

export interface ShadowedProps {
  rows: string[];
}

export default function Shadowed({ rows }: ShadowedProps) {
  const log = ref<string[]>([]);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  return (
    <div>
      <ul>
        {rows.map((once, clickOnce) => (
          <li key={once}>
            <button type="button" onClick={() => record(once)} onClickOnce={() => record(\`\${once} \${clickOnce}\`)}>
              {once}
            </button>
          </li>
        ))}
      </ul>
      <ul>
        {rows.map((onClick) => (
          <li key={onClick}>
            <button type="button" onClick={() => record(onClick)}>{onClick}</button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => { record("a"); record("b"); }}>Both</button>
      <p>{log.value.join(",")}</p>
    </div>
  );
}
`,
  "Returns.uf.tsx": `import { ref } from "unframework";

export interface ReturnsProps {
  rows: string[];
}

export default function Returns({ rows }: ReturnsProps) {
  const last = ref("none");
  const selected = ref("");
  const submitted = ref("");
  const query = ref("");
  const keys = ref(0);

  function counted(): boolean {
    keys.value += 1;
    return false;
  }

  function moveFrom(row: string, event: KeyboardEvent): boolean {
    last.value = \`\${row} \${event.key}\`;
    return false;
  }

  function handleKey(event: KeyboardEvent): boolean {
    if (event.key !== "Enter") return false;
    submitted.value = query.value;
    return true;
  }

  function choose(item: string, current: string) {
    selected.value = item;
    last.value = \`\${item} after \${current || "none"}\`;
  }

  function toggle() {
    last.value = "toggled";
    return false;
  }

  return (
    <div>
      <input
        type="text"
        aria-label="Query"
        onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
        onKeydown={(event) => handleKey(event)}
      />
      <input
        type="search"
        aria-label="Search"
        onKeydown={(event) => {
          if (event.key === "Enter") return false;
          keys.value += 1;
          return counted();
        }}
      />
      <input
        type="text"
        aria-label="Mixed"
        onKeydown={(event) => {
          if (event.key === "Escape") return false;
          keys.value += 10;
        }}
      />
      <input
        type="text"
        aria-label="Values"
        onKeydown={(event) => {
          if (event.key === "a") return keys.value > 0;
          if (event.key === "b") return selected.value || "none";
          if (event.key === "c") return rows.length;
          for (const key of ["x", "y"]) {
            if (event.key === key) return counted();
          }
          keys.value += 100;
          return event.key === "Enter" ? counted() : selected.value === "";
        }}
      />
      <button type="button" onClick={() => (keys.value > 0 ? counted() : false)}>
        Counted
      </button>
      <button type="button" onClick={() => (selected.value ? false : counted())}>
        Unselected
      </button>
      <a href="#toggled" onClick={toggle}>
        Toggle
      </a>
      <ul>
        {rows.map((row) => (
          <li key={row}>
            <input type="text" aria-label={row} onKeydown={(event) => moveFrom(row, event)} />
            <button type="button" onClick={() => choose(row, selected.value)}>
              {row}
            </button>
          </li>
        ))}
      </ul>
      <p role="status">{last.value}</p>
      <p>{submitted.value}</p>
      <output>{keys.value}</output>
    </div>
  );
}
`,
  "Collisions.uf.tsx": `import { defineEmits, ref, useTemplateRef, watch } from "unframework";

interface Settings {
  name: string;
}

export interface CollisionsProps {
  rows: string[];
}

export default function Collisions({ rows }: CollisionsProps) {
  const emit = defineEmits<{
    save: [settings: Settings];
    toggle: [id: string, open: boolean];
    page: [page: number];
    field: [];
  }>();
  const page = ref(1);
  const draft = ref<Settings>({ name: "Ada" });
  const field = useTemplateRef<HTMLInputElement>();
  const open = ref<string[]>([]);

  function save(event: SubmitEvent) {
    event.preventDefault();
    emit("save", { ...draft.value });
  }

  function toggle(id: string) {
    const isOpen = open.value.includes(id);
    open.value = isOpen ? open.value.filter((each) => each !== id) : [...open.value, id];
    emit("toggle", id, !isOpen);
  }

  function focus() {
    field.value?.focus();
    emit("field");
  }

  watch(page, (value) => {
    emit("page", value);
  });

  return (
    <form aria-label="Settings" onSubmit={save}>
      <input type="text" aria-label="Name" ref={field} />
      <p>Page {page.value}</p>
      <button type="button" onClick={() => page.value++}>
        Next
      </button>
      <button type="button" onClick={focus}>
        Focus
      </button>
      <ul>
        {rows.map((row) => (
          <li key={row}>
            <button type="button" onClick={() => toggle(row)}>
              {row}
            </button>
          </li>
        ))}
      </ul>
      <button type="submit">Save</button>
    </form>
  );
}
`,
  "Narrowing.uf.tsx": `import { computed, defineEmits, ref, useTemplateRef, watch } from "unframework";

interface Member {
  id: number;
  name: string;
  email?: string;
  owner: { email?: string } | null;
}

export interface NarrowingProps {
  user?: Member;
  rows: Member[];
}

export default function Narrowing({ user, rows }: NarrowingProps) {
  const emit = defineEmits<{ pick: [id: number]; size: [size: number]; mail: [email: string] }>();
  const selected = ref<Member | null>(null);
  const field = useTemplateRef<HTMLInputElement>();
  const owner = computed(() =>
    selected.value?.owner && selected.value.owner.email ? selected.value.owner.email : "none",
  );
  const greeting = computed(() => (user ? \`Hello, \${user.name}\` : "Hello"));

  function choose(row: Member) {
    selected.value = row;
    if (selected.value.email) emit("mail", selected.value.email);
  }

  function compare(row: Member, id: number) {
    emit("pick", row.id - id);
  }

  function invite() {
    if (selected.value) emit("pick", selected.value.id);
  }

  function measure() {
    if (!field.value) return;
    const element = field.value;
    emit("size", element.value.length + field.value.value.length);
  }

  function mail() {
    if (user && user.email) emit("mail", user.email);
  }

  const total = ref(0);
  let bonus: number | null = null;

  function tally() {
    for (const row of rows) {
      if (row.owner !== null && row.owner.email !== undefined) total.value += row.owner.email.length;
    }
    if (bonus !== null) total.value += bonus;
    bonus = rows.length;
    let index;
    for (index = 0; index < rows.length; index++) total.value += rows[index]!.id;
    total.value++;
  }

  watch(
    () => (user ? user.name : ""),
    (name) => {
      if (selected.value && name) emit("pick", selected.value.id);
    },
  );

  return (
    <div>
      <input type="text" aria-label="Field" ref={field} />
      <p>{greeting.value}</p>
      <button type="button" onClick={invite}>
        Invite
      </button>
      <button type="button" onClick={measure}>
        Measure
      </button>
      <button type="button" onClick={mail}>
        Mail
      </button>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" onClick={() => choose(row)}>
              {row.name}
            </button>
            <button type="button" onClick={() => compare(row, selected.value ? selected.value.id : 0)}>
              {\`Compare \${row.name}\`}
            </button>
          </li>
        ))}
      </ul>
      <output>{owner.value}</output>
      <button type="button" onClick={tally}>
        Tally
      </button>
      <small>{total.value}</small>
    </div>
  );
}
`,
  "Elements.uf.tsx": `import { defineEmits, onMounted, onUnmounted, ref, useTemplateRef } from "unframework";

export default function Elements() {
  const emit = defineEmits<{ handled: []; found: [same: boolean] }>();
  const handle = useTemplateRef<HTMLButtonElement>();
  const field = useTemplateRef<HTMLInputElement>();
  let handleElement: HTMLButtonElement | null = null;
  const stored = ref<HTMLInputElement | null>(null);

  function onHandleClick() {
    emit("handled");
  }

  function keep(element: HTMLInputElement | null) {
    stored.value = element;
  }

  function current(): HTMLInputElement | null {
    return field.value;
  }

  onMounted(() => {
    handleElement = handle.value;
    handleElement?.addEventListener("click", onHandleClick);
    keep(field.value);
    emit("found", field.value != null && current() === field.value);
    const box = field.value ?? handle.value;
    if (box) box.title = "seen";
  });

  onUnmounted(() => {
    handleElement?.removeEventListener("click", onHandleClick);
  });

  return (
    <div>
      <button type="button" ref={handle}>
        Handle
      </button>
      <input type="text" aria-label="Field" ref={field} />
      <p>{stored.value?.title ?? "none"}</p>
    </div>
  );
}
`,
  "Teardowns.uf.tsx": `import { defineEmits, onMounted, onUnmounted, ref, watch, watchEffect } from "unframework";

export default function Teardowns() {
  const emit = defineEmits<{ stopped: [which: string]; counted: [count: number] }>();
  const count = ref(0);
  const open = ref(false);
  const other = ref(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  function bump(): boolean {
    other.value += 1;
    return true;
  }

  onMounted(() => {
    if (count.value > 0) return false;
    bump();
  });

  watch(count, (value) => {
    if (value > 2) return bump();
    emit("counted", value);
  });

  watchEffect(() => {
    const shown = open.value;
    const total = count.value;
    if (!shown) return false;
    document.title = String(total);
  });

  onUnmounted(() => {
    if (!timer) return;
    clearInterval(timer);
    emit("stopped", "timer");
  });

  onUnmounted(() => {
    emit("stopped", "second");
  });

  return (
    <div>
      <button type="button" onClick={() => count.value++}>
        More
      </button>
      <p>{other.value}</p>
    </div>
  );
}
`,
  "Tuples.uf.tsx": `import { defineEmits, ref, watch } from "unframework";

export interface TuplesProps {
  label: string;
}

export default function Tuples({ label }: TuplesProps) {
  const emit = defineEmits<{ seen: [count: number, label: string, previous: string] }>();
  const count = ref(0);
  const moves = ref<string[]>([]);
  const all = ref<(number | string)[]>([]);

  function joined(values: (number | string)[]): string {
    return values.join("+");
  }

  function described(previous: [number | undefined, string | undefined]): string {
    return \`\${previous[0] ?? "-"}/\${previous[1] ?? "-"}\`;
  }

  watch([count, () => label], ([nextCount, nextLabel]: [number, string], [lastCount = -1, lastLabel = "none"]) => {
    moves.value = [...moves.value, \`\${lastLabel}:\${lastCount}>\${nextLabel}:\${nextCount}\`];
  });

  watch([count, () => label], (values: [number, string]) => {
    moves.value = [...moves.value, values.join("/")];
  });

  watch([count, () => label], (values, previous) => {
    all.value = values;
    moves.value = [...moves.value, \`\${joined(values)}<\${joined(previous)}\`];
  });

  watch([count, () => label], (values) => {
    moves.value = [...moves.value, \`\${values[0] + 1}\${values[1].toUpperCase()}\`];
  });

  watch([count, () => label], (next) => {
    const [at, name] = next;
    moves.value = [...moves.value, \`\${name}@\${at}\`];
  });

  watch(
    [count, () => label],
    (values, previous) => {
      emit("seen", values[0], values[1], described(previous));
    },
    { immediate: true },
  );

  watch(
    [count, () => label],
    (values: [number, string], previous: [number | undefined, string | undefined]) => {
      emit("seen", values[0], values[1], described(previous));
    },
    { immediate: true },
  );

  return (
    <div>
      <output>{moves.value.join(" ")}</output>
      <p>{all.value.length}</p>
      <button type="button" onClick={() => (count.value += 1)}>
        Move
      </button>
    </div>
  );
}
`,
};
