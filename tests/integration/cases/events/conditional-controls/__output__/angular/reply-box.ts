import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  output,
  signal,
  viewChild,
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

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
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
