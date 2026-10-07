import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  inject,
  output,
  signal,
} from "@angular/core";

@Directive({ selector: "[ufKeydownOnce]" })
export class KeydownOnce {
  readonly ufKeydownOnce = output<KeyboardEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "keydown",
      (event: KeyboardEvent) => this.ufKeydownOnce.emit(event),
      { once: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}

@Component({
  selector: "uf-reply-box",
  imports: [KeydownOnce],
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let started = this.started();
    @let suggesting = this.suggesting();
    @let accepted = this.accepted();
    <section class="reply-box" aria-label="Reply">
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
}
