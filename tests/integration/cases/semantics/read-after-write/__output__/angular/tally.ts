import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
  signal,
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

@Directive({ selector: "[ufClickCapture]" })
export class ClickCapture {
  readonly ufClickCapture = output<PointerEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "click",
      (event: PointerEvent) => this.ufClickCapture.emit(event),
      { capture: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}

@Component({
  selector: "uf-tally",
  imports: [ClickCapture, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    @let trail = this.trail();
    <section
      class="tally"
      aria-label="Tally"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">Count: {{ count }}</p>
      <button type="button" (click)="addTwice()">Add two</button>
      <button type="button" (click)="addFive()">Add five</button>
      <button type="button" (click)="countUp()">Count up three</button>
      <button type="button" (click)="addTenAndReport()">Add ten</button>
      <button
        type="button"
        (ufClickCapture)="logCapture()"
        (click)="logBubble()"
      >Log the phases</button>
      <p>Phases: {{ trail.join(" then ") }}</p>
    </section>
  `,
})
export default class Tally {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly total = output<number>();
  readonly steps = output<number[]>();
  readonly logged = output<string[]>();
  protected readonly count = signal(0);
  protected readonly trail = signal<string[]>([]);

  protected addTwice() {
    this.count.update((count) => count + 1);
    this.count.update((count) => count + 1);
    this.total.emit(this.count());
  }

  protected addFive() {
    this.count.update((count) => count + 5);
    this.total.emit(this.count());
  }

  protected countUp() {
    const seen: number[] = [];
    for (let step = 0; step < 3; step++) {
      this.count.update((count) => count + 1);
      seen.push(this.count());
    }
    this.steps.emit(seen);
  }

  private addTen() {
    this.count.update((count) => count + 10);
  }

  protected addTenAndReport() {
    this.addTen();
    this.total.emit(this.count());
  }

  protected logCapture() {
    this.trail.set([...this.trail(), "capture"]);
  }

  protected logBubble() {
    this.trail.set([...this.trail(), "bubble"]);
    this.logged.emit(this.trail());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
