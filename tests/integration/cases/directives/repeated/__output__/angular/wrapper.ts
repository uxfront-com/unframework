import Rows, { RowsRow } from "./rows";
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

/** A template of `Wrapper`'s `row` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufWrapperRow]" })
export class WrapperRow {
  static ngTemplateContextGuard(
    _directive: WrapperRow,
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
  selector: "uf-wrapper",
  imports: [Rows, RowsRow, NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      class="wrapper"
      aria-label="Rows"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <uf-rows>
        @if (this.rowTemplate(); as template) {
          <ng-template ufRowsRow>
            <ng-container [ngTemplateOutlet]="template" />
          </ng-template>
        }
      </uf-rows>
    </section>
    <ng-content select="[ufWrapperRow]" />
  `,
})
export default class Wrapper {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly rowTemplate = contentChild(WrapperRow, { read: TemplateRef });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
