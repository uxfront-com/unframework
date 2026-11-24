import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
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
  selector: "uf-draft-panel",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    @let currentStatus = this.currentStatus();
    @let log = this.log();
    <section
      class="draft-panel"
      aria-label="Draft"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" [attr.aria-expanded]="open" (click)="show()">Options</button>
      @if (open) {
        <div class="options" role="group" aria-label="Draft options">
          <button type="button" (click)="close('button')">Close</button>
        </div>
      }
      <button type="button" (click)="onListen()">Listen</button>
      <button type="button" (click)="onStopListening()">Stop listening</button>
      <button type="button" #handle>Handle</button>
      <button type="button" (click)="onSave()">Save</button>
      <p role="status">{{ open ? "Options open" : "Options closed" }}, {{ currentStatus }}</p>
      <ol aria-label="Log">
        @for (line of log; track index; let index = $index) {
          <li>{{ line }}</li>
        }
      </ol>
    </section>
  `,
})
export default class DraftPanel implements OnInit, OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly save = output<number>();
  readonly status = output<string>();
  readonly closed = output<string>();
  readonly key = output<string>();
  private readonly handle = viewChild<ElementRef<HTMLButtonElement>>("handle");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly onKey = (event: KeyboardEvent) => {
    this.record(`key ${event.key}`);
    this.key.emit(event.key);
  };
  private readonly onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close("escape");
  };
  private readonly onHandleClick = () => {
    this.record("handle");
  };
  protected readonly open = signal(false);
  protected readonly currentStatus = signal("draft");
  private readonly saves = signal(0);
  protected readonly log = signal<string[]>([]);
  private handleElement: HTMLButtonElement | null = null;

  constructor() {
    afterNextRender(() => {
      this.handleElement = this.handle()?.nativeElement ?? null;
      this.handleElement?.addEventListener("click", this.onHandleClick);
    });
  }

  ngOnInit(): void {
    const currentStatus = computed(() => this.currentStatus());
    let lastStatus = currentStatus();
    effect(
      () => {
        const value = currentStatus();
        if (Object.is(value, lastStatus)) return;
        lastStatus = value;
        untracked(() => {
          this.status.emit(value);
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.stop();
    }
  }

  private record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected close(reason: string) {
    this.open.set(false);
    document.removeEventListener("keydown", this.onEscape);
    this.closed.emit(reason);
  }

  protected show() {
    this.open.set(true);
    document.addEventListener("keydown", this.onEscape);
  }

  protected onSave() {
    this.saves.update((saves) => saves + 1);
    this.currentStatus.set("saved");
    this.save.emit(this.saves());
  }

  private stop() {
    document.removeEventListener("keydown", this.onEscape);
    document.removeEventListener("keydown", this.onKey);
    this.handleElement?.removeEventListener("click", this.onHandleClick);
  }

  protected onListen() {
    document.addEventListener("keydown", this.onKey);
  }

  protected onStopListening() {
    document.removeEventListener("keydown", this.onKey);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
