import { Component, output, signal } from "@angular/core";

@Component({
  selector: "uf-star-rating",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let stars = this.stars();
    <div class="star-rating" role="group" aria-label="Rating">
      <ul>
        @for (choice of choices; track choice) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="stars >= choice"
              (click)="choose(choice)"
            >{{ choice }}&ngsp;{{ choice === 1 ? "star" : "stars" }}</button>
          </li>
        }
      </ul>
      <p role="status">{{ stars }} of 5</p>
      <button type="button" (click)="clear()">Clear</button>
    </div>
  `,
})
export default class StarRating {
  readonly preview = output<number>();
  readonly rate = output<[stars: number, previous: number]>();
  readonly cleared = output<void>();
  protected readonly choices = [1, 2, 3, 4, 5];
  protected readonly stars = signal(0);

  protected choose(next: number) {
    const previous = this.stars();
    this.preview.emit(next);
    this.stars.set(next);
    this.rate.emit([this.stars(), previous]);
  }

  protected clear() {
    for (let star = this.stars() - 1; star >= 0; star--) {
      this.preview.emit(star);
    }
    this.stars.set(0);
    this.cleared.emit();
  }
}
