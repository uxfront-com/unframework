import Row from "./row";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  linkedSignal,
  untracked,
} from "@angular/core";

export interface Task {
  id: number;
  name: string;
  done: boolean;
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
  selector: "uf-tasks",
  imports: [Row, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tasks = this.tasks();
    <div [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <div role="list" aria-label="Tasks">
        @for (task of tasks; track task.id) {
          <uf-row [name]="task.name" [done]="task.done" />
        }
      </div>
      <button type="button" (click)="add()">Add a task</button>
      <button type="button" (click)="finish(1)">Finish the first</button>
    </div>
  `,
})
export default class Tasks implements OnInit {
  readonly initial = input.required<Task[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly tasks = linkedSignal(() => untracked(() => this.initial()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.tasks();
  }

  protected add() {
    this.tasks.set([
      ...this.tasks(),
      { id: this.tasks().length + 1, name: "Water plants", done: false },
    ]);
  }

  protected finish(id: number) {
    this.tasks.set(this.tasks().map((task) => (task.id === id ? { ...task, done: true } : task)));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
