import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface SeatPickerProps {
  pricePerSeat: number;
}

@Component({
  selector: "uf-seat-picker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let summary = this.summary();
    <section
      class="seat-picker"
      aria-label="Seats"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly quote = output<[seats: number, total: number, summary: string]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
