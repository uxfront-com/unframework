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
  signal,
} from "@angular/core";

/** A template of `Rows`'s `row` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufRowsRow]" })
export class RowsRow {
  static ngTemplateContextGuard(
    _directive: RowsRow,
    _context: unknown,
  ): _context is Record<never, never> {
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
  selector: "uf-rows",
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.items();
    <div class="rows" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <ul>
        @for (item of items; track item) {
          <li>
            @if (this.rowTemplate(); as template) {
              <ng-container [ngTemplateOutlet]="template" />
            }
          </li>
        }
      </ul>
      <button type="button" (click)="onAddRow()">Add row</button>
      <button type="button" (click)="onRemoveRow()">Remove row</button>
    </div>
    <ng-content select="[ufRowsRow]" />
  `,
})
export default class Rows {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly rowTemplate = contentChild(RowsRow, { read: TemplateRef });
  protected readonly items = signal([1, 2]);

  protected onAddRow() {
    this.items.set([...this.items(), this.items().length + 1]);
  }

  protected onRemoveRow() {
    this.items.set(this.items().slice(0, -1));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
