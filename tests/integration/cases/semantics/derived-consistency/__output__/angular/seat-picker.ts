import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

export interface SeatPickerProps {
  pricePerSeat: number;
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
  selector: "uf-seat-picker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let summary = this.summary();
    <section
      class="seat-picker"
      aria-label="Seats"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">{{ summary }}</p>
      <button type="button" (click)="addSeat()">Add a seat</button>
      <button type="button" (click)="addGroupWithGuide()">Add a group and a guide</button>
    </section>
  `,
})
export default class SeatPicker {
  readonly pricePerSeat = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly quote = output<[seats: number, total: number, summary: string]>();
  private readonly seats = signal(1);
  private readonly total = computed(() => this.seats() * this.pricePerSeat());
  protected readonly summary = computed(() =>
    this.seats() === 1 ? `1 seat for ${this.total()}` : `${this.seats()} seats for ${this.total()}`,
  );

  protected addSeat() {
    this.seats.update((seats) => seats + 1);
    this.quote.emit([this.seats(), this.total(), this.summary()]);
  }

  protected addGroupWithGuide() {
    this.seats.update((seats) => seats + 4);
    const groupTotal = this.total();
    this.seats.update((seats) => seats + 1);
    this.quote.emit([
      this.seats(),
      this.total(),
      `${this.summary()}, ${groupTotal} without the guide`,
    ]);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
