import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  InjectionToken,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface CityPickerProps {
  cities: string[];
}

const idCounter = new InjectionToken<{ next: number }>("idCounter", {
  factory: () => ({ next: 0 }),
});

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
  selector: "uf-city-picker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    @let active = this.active();
    @let chosen = this.chosen();
    @let notes = this.notes();
    @let matches = this.matches();
    <section
      class="city-picker"
      aria-label="Trip"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <form role="search" aria-label="Destination" (submit)="onDestinationSubmit($event)">
        <label>City<input
          type="search"
          name="city"
          role="combobox"
          aria-autocomplete="list"
          [attr.aria-controls]="open ? listId : undefined"
          [attr.aria-expanded]="open"
          [attr.aria-activedescendant]="open && active >= 0 ? listId + '-' + active : undefined"
          (input)="onCityInput($event)"
          (keydown)="onCityKeydown($event)"
          (blur)="onCityBlur()"
        /></label>
        @if (open) {
          <div [attr.id]="listId" role="listbox" aria-label="Cities">
            @for (city of matches; track city; let index = $index) {
              <button
                type="button"
                [attr.id]="listId + '-' + index"
                role="option"
                tabindex="-1"
                [attr.aria-selected]="index === active"
                (mousedown)="onMousedown($event)"
                (click)="choose(city)"
              >{{ city }}</button>
            }
          </div>
        }
        <button type="submit">Search</button>
      </form>
      <p role="status">{{ chosen === "" ? "No city chosen" : "Chosen: " + chosen }}</p>
      <label>Note<textarea name="note" (keydown)="onNoteKeydown($event)"></textarea></label>
      <ul aria-label="Notes">
        @for (note of notes; track index; let index = $index) {
          <li>{{ note }}</li>
        }
      </ul>
    </section>
  `,
})
export default class CityPicker {
  readonly cities = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly chose = output<string>();
  readonly noted = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly listId = `uf-id-city-picker-${inject(idCounter).next++}`;
  private readonly query = signal("");
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly chosen = signal("");
  protected readonly notes = signal<string[]>([]);
  protected readonly matches = computed(() =>
    this.cities().filter((city) => city.toLowerCase().startsWith(this.query().toLowerCase())),
  );

  protected choose(city: string) {
    this.chosen.set(city);
    this.open.set(false);
    this.active.set(-1);
    this.chose.emit(city);
  }

  protected onCityKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.open.set(true);
        this.active.set(Math.min(this.active() + 1, this.matches().length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        this.active.set(Math.max(this.active() - 1, 0));
        break;
      case "Enter": {
        event.preventDefault();
        const city = this.matches()[this.active()];
        if (this.open() && city !== undefined) this.choose(city);
        break;
      }
      case "Escape":
        event.preventDefault();
        this.open.set(false);
        this.active.set(-1);
        break;
    }
  }

  protected onNoteKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const field = event.target as HTMLTextAreaElement;
      this.notes.set([...this.notes(), field.value]);
      this.noted.emit(field.value);
      field.value = "";
    }
  }

  protected onDestinationSubmit(event: SubmitEvent) {
    event.preventDefault();
  }

  protected onCityInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
    this.open.set(true);
    this.active.set(-1);
  }

  protected onCityBlur() {
    this.open.set(false);
  }

  protected onMousedown(event: MouseEvent) {
    event.preventDefault();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
