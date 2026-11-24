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

/**
 * A checkbox group's array once a box is checked or unchecked, as Vue's `vModelCheckbox`
 * writes it (ADR-0054): a new array with the box's value added or removed.
 */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked) return index === -1 ? [...values, value] : [...values];
  return values.filter((_, at) => at !== index);
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
  selector: "uf-drinks",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let drinks = this.drinks();
    <fieldset
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <legend>Drinks</legend>
      <label><input
        type="checkbox"
        value="tea"
        #drinksField
        [checked]="this.drinks().includes('tea')"
        (change)="this.drinks.set(toggle(this.drinks(), 'tea', drinksField.checked))"
      /> Tea</label>
      <label><input
        type="checkbox"
        value="coffee"
        #drinksField_1
        [checked]="this.drinks().includes('coffee')"
        (change)="this.drinks.set(toggle(this.drinks(), 'coffee', drinksField_1.checked))"
      /> Coffee</label>
      <label><input
        type="checkbox"
        value="juice"
        #drinksField_2
        [checked]="this.drinks().includes('juice')"
        (change)="this.drinks.set(toggle(this.drinks(), 'juice', drinksField_2.checked))"
      /> Juice</label>
      <output>Ordered: {{ drinks.join(", ") || "nothing" }}</output>
      <button type="button" (click)="onOnlyJuice()">Only juice</button>
    </fieldset>
  `,
})
export default class Drinks {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFieldSetElement>>("ufElement");
  protected readonly drinks = signal<string[]>(["tea"]);
  protected readonly toggle = toggle;

  protected onOnlyJuice() {
    this.drinks.set(["juice"]);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
