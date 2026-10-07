import {
  Component,
  ElementRef,
  type OnInit,
  computed,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

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

@Component({
  selector: "uf-task-board",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let filters = this.filters();
    @let open = this.open();
    @let alphabetical = this.alphabetical();
    @let newestFirst = this.newestFirst();
    @let kinds = this.kinds();
    @let byId = this.byId();
    @let titlesByKind = this.titlesByKind();
    @let finishedByKind = this.finishedByKind();
    @let byState = this.byState();
    @let progress = this.progress();
    <section class="task-board" aria-label="Tasks">
      <ol aria-label="Open">
        @for (task of open; track task.id) {
          <li
            [class]="{ first: task.rank === 1 }"
          >{{ task.title }}<button
            type="button"
            (click)="finish(task.id)"
          >{{ "Finish " + task.title }}</button></li>
        }
      </ol>
      <div class="meter" role="presentation">
        <div class="fill" [style.width]="progress + '%'"></div>
      </div>
      <p>Alphabetical: {{ alphabetical.map((task) => task.title).join(", ") }}</p>
      <p>Newest first: {{ newestFirst.join(", ") }}</p>
      <ul aria-label="Kinds">
        @for (line of kinds; track line) {
          <li>{{ line }}</li>
        }
      </ul>
      <p>Task 2: {{ byId[2]?.title }}</p>
      <p>Code tasks: {{ titlesByKind["code"]?.join(", ") }}</p>
      <p>Finished code tasks: {{ finishedByKind.get("code") ?? 0 }}</p>
      <p>Done: {{ byState["done"]?.join(", ") ?? "nothing" }}</p>
      <button type="button" (click)="addTag('urgent')">Tag urgent</button>
      <button type="button" (click)="addTag('later')">Tag later</button>
      <p>Tags: {{ filters.tags.join(", ") }}</p>
      <label>Notes<textarea #notes name="notes" class="notes" (input)="resize()"></textarea></label>
      <label>Summary<textarea
        name="summary"
        class="summary"
        (input)="sizeSummary($event)"
      ></textarea></label>
    </section>
  `,
})
export default class TaskBoard implements OnInit {
  readonly initial = input.required<Task[]>();
  private readonly notes = viewChild<ElementRef<HTMLTextAreaElement>>("notes");
  private readonly tasks = linkedSignal(() => untracked(() => this.initial()));
  protected readonly filters = signal<Filters>({ query: "", tags: [] });
  protected readonly open = computed(() =>
    this.tasks()
      .filter((task) => !task.done)
      .sort((a, b) => a.rank - b.rank),
  );
  protected readonly alphabetical = computed(() =>
    this.tasks()
      .slice()
      .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)),
  );
  protected readonly newestFirst = computed(() =>
    this.tasks()
      .map((task) => task.title)
      .reverse(),
  );
  protected readonly kinds = computed(() => {
    const byKind: Record<string, Task[]> = {};
    for (const task of this.tasks()) {
      if (!byKind[task.kind]) byKind[task.kind] = [];
      byKind[task.kind]!.push(task);
    }
    return Object.keys(byKind).map((kind) => `${kind}: ${byKind[kind]!.length}`);
  });
  protected readonly byId = computed(() =>
    this.tasks().reduce<Record<number, Task>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {}),
  );
  protected readonly titlesByKind = computed(() =>
    this.tasks().reduce<Record<string, string[]>>((acc, task) => {
      (acc[task.kind] ||= []).push(task.title);
      return acc;
    }, {}),
  );
  protected readonly finishedByKind = computed(() =>
    this.tasks().reduce((acc, task) => {
      if (task.done) acc.set(task.kind, (acc.get(task.kind) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()),
  );
  protected readonly byState = computed(() => {
    const groups: Record<string, string[]> = {};
    for (const task of this.tasks()) {
      const state = task.done ? "done" : "open";
      groups[state] ??= [];
      groups[state]!.push(task.title);
    }
    return groups;
  });
  protected readonly progress = computed(() =>
    Math.round((this.tasks().filter((task) => task.done).length / this.tasks().length) * 100),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.tasks();
  }

  protected finish(id: number) {
    this.tasks.set(this.tasks().map((task) => (task.id === id ? { ...task, done: true } : task)));
  }

  protected addTag(tag: string) {
    const next = { ...this.filters(), tags: [...this.filters().tags] };
    next.tags.push(tag);
    this.filters.set(next);
  }

  protected resize() {
    const field = this.notes()?.nativeElement ?? null;
    if (!field) return;
    const lines = field.value.split("\n").length;
    field.style.height = `${Math.max(lines, 2) * 1.5}em`;
    field.classList.toggle("tall", lines > 3);
  }

  protected sizeSummary(event: Event) {
    const area = event.currentTarget as HTMLTextAreaElement;
    const lines = area.value.split("\n").length;
    area.style.height = `${Math.max(lines, 2) * 1.5}em`;
    area.classList.toggle("tall", lines > 3);
  }
}
