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
  imports: [KeydownOnce, ScopeAttributes],
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
      [ufScope]="this.host"
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
