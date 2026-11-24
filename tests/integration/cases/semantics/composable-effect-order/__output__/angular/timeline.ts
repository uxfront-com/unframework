import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useTracked } from "./use-tracked";
import {
  Component,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  afterNextRender,
  effect,
  inject,
  input,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-timeline",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let entries = this.entries();
    @let count = this.tracked.count();
    <section
      class="timeline"
      aria-label="Timeline"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">Count: {{ count }}</p>
      <button type="button" (click)="void tracked.increment()">Increment</button>
      <ol>
        @for (entry of entries; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class Timeline implements OnInit, OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly entries = signal<string[]>([]);
  private readonly trackedInjector = Injector.create({ providers: [], parent: this.injector });
  protected readonly tracked: ReturnType<typeof this.createTracked>;

  constructor() {
    afterNextRender(() => {
      this.record("caller mounted first");
    });

    this.tracked = runInInjectionContext(this.trackedInjector, () => this.createTracked());

    afterNextRender(() => {
      this.record("caller mounted last");
    });
  }

  ngOnInit(): void {
    let lastCount = this.tracked.count();
    effect(
      () => {
        const value = this.tracked.count();
        if (Object.is(value, lastCount)) return;
        lastCount = value;
        untracked(() => this.record("caller watcher"));
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    this.trackedInjector.destroy();
  }

  private record(entry: string) {
    this.entries.set([...this.entries(), entry]);
  }

  private createTracked() {
    return useTracked((entry) => this.record(entry));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
