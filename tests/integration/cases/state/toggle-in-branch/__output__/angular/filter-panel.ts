import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  signal,
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

@Component({
  selector: "uf-filter-panel",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    @let colour = this.colour();
    @let note = this.note();
    <section
      class="filter-panel"
      aria-label="Filters"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      @if (open) {
        <button type="button" aria-expanded="true" (click)="onHideColours()">Hide colours</button>
      } @else {
        <button type="button" aria-expanded="false" (click)="onShowColours()">Show colours</button>
      }
      @if (open) {
        <div class="colours">
          <button type="button" (click)="onRed()">Red</button>
          <button type="button" (click)="onBlue()">Blue</button>
          <button type="button" (click)="onReset()">Reset</button>
        </div>
      }
      @if (colour) {
        <div class="selection">
          <p>{{ "Colour: " + colour }}</p>
          <button type="button" (click)="onClick()">{{ "Clear " + colour }}</button>
        </div>
      } @else {
        <p>No colour</p>
      }
      @if (note === null) {
        <button type="button" (click)="onAddANote()">Add a note</button>
      } @else {
        <div class="note">
          <label>Note<input (input)="onInput($event)" (keydown)="onKeydown($event)" /></label>
          <p>{{ 'Draft: "' + note + '"' }}</p>
        </div>
      }
    </section>
  `,
})
export default class FilterPanel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly open = signal(false);
  protected readonly colour = signal<string | null>(null);
  protected readonly note = signal<string | null>(null);

  protected onHideColours() {
    this.open.set(false);
  }

  protected onShowColours() {
    this.open.set(true);
  }

  protected onRed() {
    this.colour.set("Red");
  }

  protected onBlue() {
    this.colour.set("Blue");
  }

  protected onReset() {
    this.colour.set(null);
    this.open.set(false);
  }

  protected onClick() {
    this.colour.set(null);
  }

  protected onAddANote() {
    this.note.set("");
  }

  protected onInput(event: InputEvent) {
    this.note.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      this.note.set(null);
    }
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
