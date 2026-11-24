import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { NgTemplateOutlet, isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  TemplateRef,
  contentChild,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

/** What a template of `Picker`'s `option` slot reads: the slot's props. */
export type PickerOptionContext = { option: { id: string; label: string } };

/** A template of `Picker`'s `option` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufPickerOption]" })
export class PickerOption {
  static ngTemplateContextGuard(
    _directive: PickerOption,
    _context: unknown,
  ): _context is PickerOptionContext & { $implicit: PickerOptionContext } {
    return true;
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
  selector: "uf-picker",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let options = this.options();
    <div
      class="picker"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <ul aria-label="Options">
        @for (option of options; track option.id) {
          <li>
            @if (this.optionTemplate(); as template) {
              <ng-container
                [ngTemplateOutlet]="template"
                [ngTemplateOutletContext]="{ $implicit: { option: option }, option: option }"
              />
            }
          </li>
        }
      </ul>
      <button type="button" (click)="onReverseOptions()">Reverse options</button>
      <button type="button" (click)="onRemoveOption()">Remove option</button>
    </div>
    <ng-content select="[ufPickerOption]" />
  `,
})
export default class Picker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly optionTemplate = contentChild(PickerOption, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly options = signal([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  protected onReverseOptions() {
    this.options.set([...this.options()].reverse());
  }

  protected onRemoveOption() {
    this.options.set(this.options().filter((option) => option.id !== "y"));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
