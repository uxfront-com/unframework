import Row from "./row";
import { Component, type OnInit, input, linkedSignal, untracked } from "@angular/core";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

@Component({
  selector: "uf-tasks",
  imports: [Row],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tasks = this.tasks();
    <div [class]="this.class()" [style]="this.style()">
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
}
