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
  viewChild,
} from "@angular/core";

export interface FilterPanelProps {
  heading: string;
  hint: string;
  category: string;
  expanded: boolean;
  inStockOnly: boolean;
  locked: boolean;
  mandatory: boolean;
  loading: boolean;
  invalid?: boolean;
  current?: "page" | "step";
}

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
  selector: "uf-filter-panel",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let heading = this.heading();
    @let hint = this.hint();
    @let category = this.category();
    @let expanded = this.expanded();
    @let inStockOnly = this.inStockOnly();
    @let locked = this.locked();
    @let mandatory = this.mandatory();
    @let loading = this.loading();
    @let invalid = this.invalid();
    @let current = this.current();
    <section
      class="filter-panel"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : heading"
      [attr.data-category]="'data-category' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-category'] : category"
      data-layout="stacked"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button
        type="button"
        [attr.aria-expanded]="expanded"
        aria-describedby="filter-panel-hint"
      >Price filters</button>
      <p id="filter-panel-hint">{{ hint }}</p>
      <details [attr.open]="expanded ? '' : null">
        <summary>Price range</summary>
        <label>Minimum price<input
          type="number"
          name="min-price"
          [attr.required]="mandatory ? '' : null"
          [attr.disabled]="locked ? '' : null"
          [attr.aria-invalid]="invalid"
        /></label>
      </details>
      <button
        type="button"
        [attr.aria-pressed]="inStockOnly"
        [attr.disabled]="locked ? '' : null"
      >In stock only</button>
      <nav aria-label="Filter steps">
        <a href="#filters" [attr.aria-current]="current">Filters</a>
      </nav>
      <p
        role="status"
        aria-live="polite"
        [attr.aria-busy]="loading"
      >{{ loading ? "Loading results" : "Results ready" }}</p>
    </section>
  `,
})
export default class FilterPanel {
  readonly heading = input.required<string>();
  readonly hint = input.required<string>();
  readonly category = input.required<string>();
  readonly expanded = input.required<boolean>();
  readonly inStockOnly = input.required<boolean>();
  readonly locked = input.required<boolean>();
  readonly mandatory = input.required<boolean>();
  readonly loading = input.required<boolean>();
  readonly invalid = input<boolean>();
  readonly current = input<"page" | "step">();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
