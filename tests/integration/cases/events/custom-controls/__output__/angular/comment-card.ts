import { Component, output, signal } from "@angular/core";

@Component({
  selector: "uf-comment-card",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    @let currentLiked = this.currentLiked();
    <section class="comment-card" aria-label="Comment">
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
  readonly liked = output<[liked: boolean, by: string]>();
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
}
