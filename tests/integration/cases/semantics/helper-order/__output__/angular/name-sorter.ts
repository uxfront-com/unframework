import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
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
  selector: "uf-name-sorter",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let names = this.names();
    @let count = this.count();
    <section
      class="name-sorter"
      aria-label="Names"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>Names: {{ names.join(", ") }}</p>
      <p>Added: {{ count }}</p>
      <button type="button" (click)="add('Bo')">Add Bo</button>
      <button type="button" (click)="report()">Report</button>
    </section>
  `,
})
export default class NameSorter implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly started = output<string>();
  readonly firstSeen = output<string>();
  readonly secondSeen = output<number>();
  readonly total = output<number>();
  private readonly injector = inject(Injector);
  private readonly compare = (a: string, b: string): number => {
    return a < b ? -1 : a > b ? 1 : 0;
  };
  protected readonly names = signal(["Cy", "Al"].toSorted((a, b) => this.compare(a, b)));
  protected readonly count = signal(0);
  private readonly doubled = computed(() => this.count() * 2);
  private readonly letters = computed(() => this.names().join("").length);

  constructor() {
    afterNextRender(() => {
      this.started.emit(`first ${this.describe()}`);
    });

    afterNextRender(() => {
      this.started.emit("second");
    });
  }

  ngOnInit(): void {
    const currentCount = computed(() => this.count());
    let lastCount = currentCount();
    effect(
      () => {
        const value = currentCount();
        if (Object.is(value, lastCount)) return;
        lastCount = value;
        untracked(() => {
          this.firstSeen.emit(this.describe());
        });
      },
      { injector: this.injector },
    );

    const currentCount_1 = computed(() => this.count());
    let lastCount_1 = currentCount_1();
    effect(
      () => {
        const value = currentCount_1();
        if (Object.is(value, lastCount_1)) return;
        lastCount_1 = value;
        untracked(() => {
          this.secondSeen.emit(value);
        });
      },
      { injector: this.injector },
    );
  }

  private describe(): string {
    return `doubled ${this.doubled()}`;
  }

  protected add(name: string) {
    this.names.set([...this.names(), name].toSorted(this.compare));
    this.count.update((count) => count + 1);
  }

  protected report() {
    this.total.emit(this.letters());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
