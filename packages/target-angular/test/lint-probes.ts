// What this target emits for M1's constructs, in the shapes of design §5.5 as the emitter prints
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
