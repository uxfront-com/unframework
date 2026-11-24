import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  ApplicationRef,
  Component,
  ElementRef,
  Injector,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

export interface ImportQueueProps {
  files: string[];
}

@Component({
  selector: "uf-import-queue",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    @let attempts = this.attempts();
    <section
      class="import-queue"
      aria-label="Import"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" (click)="importAll()">Import all</button>
      <p role="status">{{ status }}, {{ attempts }} attempts</p>
    </section>
  `,
})
export default class ImportQueue implements OnInit {
  readonly files = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufProgress = output<[status: string, attempts: number]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  protected readonly status = signal("idle");
  protected readonly attempts = signal(0);

  ngOnInit(): void {
    const currentValues = computed(
      () => [this.status(), this.attempts()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues = currentValues();
    effect(
      () => {
        const current = currentValues();
        if (Object.is(current, lastValues)) return;
        const [nextStatus, nextAttempts] = current;
        lastValues = current;
        untracked(() => {
          this.ufProgress.emit([nextStatus, nextAttempts]);
        });
      },
      { injector: this.injector },
    );
  }

  protected async importAll() {
    this.status.set("starting");
    for (const file of this.files()) {
      this.attempts.update((attempts) => attempts + 1);
      await this.nextTick();
      this.status.set(`imported ${file}`);
    }
    this.status.set("done");
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
