import { useTracked } from "./use-tracked";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  Renderer2,
  afterNextRender,
  effect,
  inject,
  input,
  runInInjectionContext,
  signal,
  untracked,
} from "@angular/core";

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
  selector: "uf-timeline",
  imports: [ScopeAttributes],
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
      [ufScope]="this.host"
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
