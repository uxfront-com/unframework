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

export interface SizePickerProps {
  legend: string;
  sizes: string[];
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
  selector: "uf-size-picker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let legend = this.legend();
    @let sizes = this.sizes();
    @let picked = this.picked();
    <fieldset
      class="size-picker"
      [attr.aria-describedby]="hintId"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <legend>{{ legend }}</legend>
      <p [attr.id]="hintId">Pick one size.</p>
      @for (size of sizes; track size; let index = $index) {
        <div class="size">
          <input
            type="radio"
            [attr.id]="group + '-' + index"
            [attr.name]="group"
            [attr.value]="size"
            (change)="choose(size)"
          />
          <label [attr.for]="group + '-' + index">{{ size }}</label>
        </div>
      }
      <output>{{ picked || "none" }}</output>
    </fieldset>
  `,
})
export default class SizePicker {
  readonly legend = input.required<string>();
  readonly sizes = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly group = `uf-id-size-picker-${nextId++}`;
  protected readonly hintId = `uf-id-size-picker-${nextId++}`;
  protected readonly picked = signal("");

  protected choose(size: string) {
    this.picked.set(size);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
