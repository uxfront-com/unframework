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

/** A template of `Card`'s `header` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufCardHeader]" })
export class CardHeader {
  static ngTemplateContextGuard(
    _directive: CardHeader,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

/** A template of `Card`'s `footer` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufCardFooter]" })
export class CardFooter {
  static ngTemplateContextGuard(
    _directive: CardFooter,
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
  selector: "uf-card",
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <article class="card" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <header>
        @if (this.headerTemplate(); as template) {
          <ng-container [ngTemplateOutlet]="template" />
        }
      </header>
      <div class="body">
        <ng-content />
      </div>
      <footer>
        @if (this.footerTemplate(); as template) {
          <ng-container [ngTemplateOutlet]="template" />
        }
      </footer>
    </article>
    <ng-content select="[ufCardHeader]" />
    <ng-content select="[ufCardFooter]" />
  `,
})
export default class Card {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly headerTemplate = contentChild(CardHeader, { read: TemplateRef });
  protected readonly footerTemplate = contentChild(CardFooter, { read: TemplateRef });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
