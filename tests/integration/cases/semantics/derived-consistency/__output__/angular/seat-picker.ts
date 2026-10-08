import { Component, computed, input, output, signal } from "@angular/core";

export interface SeatPickerProps {
  pricePerSeat: number;
}

@Component({
  selector: "uf-seat-picker",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let summary = this.summary();
    <section class="seat-picker" aria-label="Seats">
      <p role="status">{{ summary }}</p>
      <button type="button" (click)="addSeat()">Add a seat</button>
      <button type="button" (click)="addGroupWithGuide()">Add a group and a guide</button>
    </section>
  `,
})
export default class SeatPicker {
  readonly pricePerSeat = input.required<number>();
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
}
