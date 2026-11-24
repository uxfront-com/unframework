import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface QuickActionsProps {
  actions: string[];
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
  selector: "uf-quick-actions",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let actions = this.actions();
    @let query = this.query();
    @let lastKey = this.lastKey();
    @let subscriptions = this.subscriptions();
    <section
      class="quick-actions"
      aria-label="Quick actions"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Search<input
        name="query"
        (input)="onQueryInput($event)"
        (keydown)="onQueryKeydown($event)"
      /></label>
      <p>Query: {{ query }}</p>
      <label>Note<input name="note" (keydown)="void track($event)" /></label>
      <label>Scope<select
        name="scope"
        (change)="onScopeChange($event)"
      ><option value="mine">Mine</option><option value="team">Team</option></select></label>
      <ul aria-label="Actions">
        @for (action of actions; track action) {
          <li>
            <label>{{ "Shortcut for " + action }}<input
              [attr.name]="action"
              (keydown)="void keyFor(action, $event)"
            /></label>
            <button
              type="button"
              (click)="choose(action, this.scope())"
            >{{ "Run " + action }}</button>
          </li>
        }
      </ul>
      <p>Last key: {{ lastKey }}</p>
      <form
        class="subscribe"
        aria-label="Subscribe"
        (submit)="once(submitOnce, $event) && onSubscribeSubmitOnce($event); onSubscribeSubmit($event)"
      >
        <p>Subscriptions: {{ subscriptions }}</p>
        <button type="submit">Subscribe</button>
      </form>
    </section>
  `,
})
export default class QuickActions {
  readonly actions = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly welcomed = output<void>();
  readonly subscribed = output<number>();
  readonly chosen = output<[action: string, scope: string]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly query = signal("");
  protected readonly lastKey = signal("none");
  protected readonly scope = signal("mine");
  protected readonly subscriptions = signal(0);
  protected readonly submitOnce = new WeakSet<EventTarget>();

  private clear(event: KeyboardEvent) {
    event.preventDefault();
    this.query.set("");
  }

  protected track(event: KeyboardEvent): boolean {
    this.lastKey.set(event.key);
    return event.key === "Enter";
  }

  protected keyFor(action: string, event: KeyboardEvent): boolean {
    this.lastKey.set(`${action}: ${event.key}`);
    return false;
  }

  protected choose(action: string, current: string) {
    this.chosen.emit([action, current]);
  }

  protected onQueryInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onQueryKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.clear(event);
  }

  protected onScopeChange(event: Event) {
    this.scope.set((event.currentTarget as HTMLSelectElement).value);
  }

  protected onSubscribeSubmitOnce(event: SubmitEvent) {
    event.preventDefault();
    this.welcomed.emit();
  }

  protected onSubscribeSubmit(event: SubmitEvent) {
    event.preventDefault();
    this.subscriptions.update((subscriptions) => subscriptions + 1);
    this.subscribed.emit(this.subscriptions());
  }

  protected once(elements: WeakSet<EventTarget>, event: Event): boolean {
    const element = event.currentTarget;
    if (element === null || elements.has(element)) return false;
    elements.add(element);
    return true;
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
