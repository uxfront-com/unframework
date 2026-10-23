import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

export interface CityPickerProps {
  cities: string[];
}

let nextId = 0;

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

@Component({
  selector: "uf-city-picker",
  imports: [ScopeAttributes],
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
      [ufScope]="this.host"
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
  readonly chose = output<string>();
  readonly noted = output<string>();
  protected readonly listId = `uf-id-city-picker-${nextId++}`;
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
