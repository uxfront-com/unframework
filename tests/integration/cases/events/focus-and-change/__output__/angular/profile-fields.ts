import { isPlatformBrowser } from "@angular/common";
import {
  Component,
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

@Component({
  selector: "uf-profile-fields",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let nickname = this.nickname();
    @let cardFocuses = this.cardFocuses();
    @let cardBlurs = this.cardBlurs();
    <section
      class="profile-fields"
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <div
        class="name-group"
        role="group"
        aria-label="Name fields"
        (focusin)="record('group focusin')"
        (focusout)="record('group focusout')"
      >
        <label>Name<input name="name" (focus)="record('name focus')" (blur)="record('name blur')" /></label>
      </div>
      <label>Nickname<input
        name="nickname"
        (change)="onNicknameChange($event); void (once(changeOnce, $event) && onNicknameChangeOnce($event))"
      /></label>
      <p>Nickname: {{ nickname }}</p>
      <label><input
        type="checkbox"
        name="public"
        (click)="record('public click')"
        (input)="record('public input')"
        (change)="record('public change')"
      />Public profile</label>
      <label><input
        type="checkbox"
        name="locked"
        (click)="hold($event)"
        (change)="record('locked change')"
      />Locked</label>
      <div
        class="card"
        role="group"
        aria-label="Card"
        tabindex="-1"
        (focus)="onCardFocus()"
        (blur)="onCardBlur()"
      >
        <p>{{ cardFocuses > cardBlurs ? "Card focused" : "Card not focused" }}</p>
        <p>Card blurs: {{ cardBlurs }}</p>
        <button type="button" (click)="record('card button')">Inside the card</button>
      </div>
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class ProfileFields {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly firstNickname = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly log = signal<string[]>([]);
  protected readonly nickname = signal("");
  protected readonly cardFocuses = signal(0);
  protected readonly cardBlurs = signal(0);
  protected readonly changeOnce = new WeakSet<EventTarget>();

  protected record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected hold(event: MouseEvent) {
    event.preventDefault();
    this.record("locked click");
  }

  protected onNicknameChange(event: Event) {
    this.nickname.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onNicknameChangeOnce(event: Event) {
    this.firstNickname.emit((event.currentTarget as HTMLInputElement).value);
  }

  protected onCardFocus() {
    this.cardFocuses.update((cardFocuses) => cardFocuses + 1);
  }

  protected onCardBlur() {
    this.cardBlurs.update((cardBlurs) => cardBlurs + 1);
  }

  protected once(elements: WeakSet<EventTarget>, event: Event): boolean {
    const element = event.currentTarget;
    if (element === null || elements.has(element)) return false;
    elements.add(element);
    return true;
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
