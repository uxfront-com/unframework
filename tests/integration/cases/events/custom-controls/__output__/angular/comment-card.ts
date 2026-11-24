import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-comment-card",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    @let currentLiked = this.currentLiked();
    <section
      class="comment-card"
      aria-label="Comment"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Comment<textarea name="comment" rows="2" (input)="autosize($event)"></textarea></label>
      <div class="meter" role="presentation">
        <div class="fill" [style.width]="Math.min(text.length, 100) + '%'"></div>
      </div>
      <p>{{ text.length }} characters</p>
      <div
        class="like"
        role="button"
        tabindex="0"
        [attr.aria-pressed]="currentLiked"
        (click)="toggleLike($event)"
        (keydown)="onLikeKeydown($event)"
      >Like</div>
    </section>
  `,
})
export default class CommentCard {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly liked = output<[liked: boolean, by: string]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly text = signal("");
  protected readonly currentLiked = signal(false);
  protected readonly Math = Math;

  protected autosize(event: Event) {
    const area = event.currentTarget as HTMLTextAreaElement;
    this.text.set(area.value);
    area.style.height = `${Math.max(area.value.split("\n").length, 2) * 1.5}em`;
  }

  protected toggleLike(event: MouseEvent | KeyboardEvent) {
    this.currentLiked.set(!this.currentLiked());
    this.liked.emit([this.currentLiked(), event.type]);
  }

  protected onLikeKeydown(event: KeyboardEvent) {
    if (event.key === " ") event.preventDefault();
    if (event.key === "Enter" || event.key === " ") this.toggleLike(event);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
