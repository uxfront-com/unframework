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
  signal,
  viewChild,
} from "@angular/core";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

/**
 * Class names as Vue's `normalizeClass` reads them (ADR-0065): a string as it is, an array's
 * entries and an object's keys whose values are truthy, Angular's `[class]` taking the string.
 */
function classNames(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(classNames).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.entries(value)
    .flatMap(([key, on]) => (on ? [key] : []))
    .join(" ");
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
  selector: "uf-tag-list",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let tags = this.tags();
    @let states = this.states();
    @let extra = this.extra();
    @let expanded = this.expanded();
    <div
      class="tag-list"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <span
        class="tag"
        [class]="classNames([tags, states, { 'tag-open': expanded }])"
      >{{ label }}</span>
      <span [class]="classNames(tags)">Plain</span>
      <span [class]="classNames([extra, expanded ? ['tag-wide', 'tag-tall'] : []])">Extra</span>
      <button type="button" (click)="expand()">Expand</button>
    </div>
  `,
})
export default class TagList {
  readonly label = input.required<string>();
  readonly tags = input.required<string[]>();
  readonly states = input.required<TagStates>();
  readonly extra = input<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly expanded = signal(false);
  protected readonly classNames = classNames;

  protected expand() {
    this.expanded.set(!this.expanded());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
