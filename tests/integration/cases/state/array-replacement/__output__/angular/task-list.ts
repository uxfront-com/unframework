import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from "@angular/core";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-task-list",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tasks = this.tasks();
    @let selected = this.selected();
    <section
      class="task-list"
      aria-label="Tasks"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      @if (tasks.length === 0) {
        <p>No tasks yet.</p>
      } @else {
        <ul>
          @for (task of tasks; track task.id) {
            <li>
              <button
                type="button"
                [attr.aria-pressed]="selected === task.id"
                (click)="select(task.id)"
              >{{ task.label }}</button>
              <button
                type="button"
                [attr.aria-label]="'Remove ' + task.label"
                (click)="remove(task.id)"
              >Remove</button>
            </li>
          }
        </ul>
      }
      <button type="button" (click)="add()">Add task</button>
      <button type="button" (click)="moveUp()">Move up</button>
    </section>
  `,
})
export default class TaskList implements OnInit {
  readonly initial = input.required<Task[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly tasks = linkedSignal(() => untracked(() => this.initial()));
  protected readonly selected = signal<string | undefined>(undefined);
  private added = 0;

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.tasks();
  }

  protected add() {
    this.added += 1;
    this.tasks.set([...this.tasks(), { id: `new-${this.added}`, label: `New task ${this.added}` }]);
  }

  protected select(id: string) {
    this.selected.set(id);
  }

  protected remove(id: string) {
    this.tasks.set(this.tasks().filter((entry) => entry.id !== id));
  }

  protected moveUp() {
    const index = this.tasks().findIndex((entry) => entry.id === this.selected());
    const above = this.tasks()[index - 1];
    const current = this.tasks()[index];
    if (index > 0 && above && current) {
      this.tasks.set(this.tasks().toSpliced(index - 1, 2, current, above));
    }
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
