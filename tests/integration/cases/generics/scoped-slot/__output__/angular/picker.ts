import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  TemplateRef,
  contentChild,
  inject,
  input,
} from "@angular/core";

export interface PickerProps<T> {
  items: T[];
}

/** What a template of `Picker`'s `item` slot reads: the slot's props. */
export type PickerItemContext = { item: T };

/** A template of `Picker`'s `item` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufPickerItem]" })
export class PickerItem {
  static ngTemplateContextGuard(
    _directive: PickerItem,
    _context: unknown,
  ): _context is PickerItemContext & { $implicit: PickerItemContext } {
    return true;
  }
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

@Component({
  selector: "uf-picker",
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.items();
    <ul [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      @for (item of items; track index; let index = $index) {
        <li>
          @if (this.itemTemplate(); as template) {
            <ng-container
              [ngTemplateOutlet]="template"
              [ngTemplateOutletContext]="{ $implicit: { item: item }, item: item }"
            />
          }
        </li>
      }
    </ul>
    <ng-content select="[ufPickerItem]" />
  `,
})
export default class Picker {
  readonly items = input.required<T[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly itemTemplate = contentChild(PickerItem, { read: TemplateRef });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
