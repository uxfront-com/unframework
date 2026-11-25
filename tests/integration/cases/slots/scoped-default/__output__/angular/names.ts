import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  TemplateRef,
  contentChild,
  inject,
  input,
  viewChild,
} from "@angular/core";

/** What a template of `Names`'s `default` slot reads: the slot's props. */
export type NamesDefaultContext = { item: string };

/** A template of `Names`'s `default` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufNamesDefault]" })
export class NamesDefault {
  static ngTemplateContextGuard(
    _directive: NamesDefault,
    _context: unknown,
  ): _context is NamesDefaultContext & { $implicit: NamesDefaultContext } {
    return true;
  }
}

@Component({
  selector: "uf-names",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let names = this.names();
    <ul
      aria-label="Names"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (item of names; track item) {
        <li>
          @if (this.defaultTemplate(); as template) {
            <ng-container
              [ngTemplateOutlet]="template"
              [ngTemplateOutletContext]="{ $implicit: { item: item }, item: item }"
            />
          }
        </li>
      }
    </ul>
    <ng-content select="[ufNamesDefault]" />
  `,
})
export default class Names {
  readonly names = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly defaultTemplate = contentChild(NamesDefault, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
