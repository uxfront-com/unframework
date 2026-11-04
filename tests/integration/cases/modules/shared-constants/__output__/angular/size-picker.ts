import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
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
  selector: "uf-size-picker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    <fieldset
      class="size-picker"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <legend>Size</legend>
      <p role="status">Picked: {{ SIZES[size] }}</p>
      <ul>
        @for (each of SIZE_ORDER; track each) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="size === each"
              (click)="pick(each)"
            >{{ SIZES[each] }}</button>
          </li>
        }
      </ul>
    </fieldset>
  `,
})
export default class SizePicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly size = signal<Size>(DEFAULT_SIZE);
  protected readonly SIZES = SIZES;
  protected readonly SIZE_ORDER = SIZE_ORDER;

  protected pick(next: Size) {
    this.size.set(next);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
