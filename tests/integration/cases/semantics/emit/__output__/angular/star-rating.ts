import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-star-rating",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let stars = this.stars();
    <div
      class="star-rating"
      role="group"
      aria-label="Rating"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly preview = output<number>();
  readonly rate = output<[stars: number, previous: number]>();
  readonly cleared = output<void>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
