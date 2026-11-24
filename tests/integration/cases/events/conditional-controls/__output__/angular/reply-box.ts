import { Fallthrough } from "./_unframework/Fallthrough";
import { KeydownOnce } from "./_unframework/KeydownOnce";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-reply-box",
  imports: [KeydownOnce, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let started = this.started();
    @let suggesting = this.suggesting();
    @let accepted = this.accepted();
    <section
      class="reply-box"
      aria-label="Reply"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Message<textarea name="message" (ufKeydownOnce)="onMessageKeydown($event)"></textarea></label>
      <p>{{ started ? "Started" : "Not started" }}</p>
      <label>Answer<textarea name="answer" (keydown)="onAnswerKeydown($event)"></textarea></label>
      <button
        type="button"
        [attr.aria-pressed]="suggesting"
        (click)="onSuggestions()"
      >Suggestions</button>
      <p>Accepted: {{ accepted }}</p>
    </section>
  `,
})
export default class ReplyBox {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly started = signal(false);
  protected readonly suggesting = signal(false);
  protected readonly accepted = signal(0);

  private accept(event: KeyboardEvent) {
    event.preventDefault();
    this.suggesting.set(false);
    this.accepted.update((accepted) => accepted + 1);
  }

  protected onMessageKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
    this.started.set(true);
  }

  protected onAnswerKeydown(event: KeyboardEvent) {
    if (this.suggesting() && event.key === "Enter") this.accept(event);
  }

  protected onSuggestions() {
    this.suggesting.set(!this.suggesting());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
