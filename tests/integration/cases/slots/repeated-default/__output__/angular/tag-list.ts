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

/** A template of `TagList`'s `default` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufTagListDefault]" })
export class TagListDefault {
  static ngTemplateContextGuard(
    _directive: TagListDefault,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-tag-list",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let ordered = this.ordered();
    @let label = this.label();
    @let items = this.items();
    @switch (ordered ? "ol" : "ul") {
      @case ("ol") {
        <ol
          class="tag-list"
          [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @for (item of items; track item) {
            <li>
              @if (this.defaultTemplate(); as template) {<ng-container
                [ngTemplateOutlet]="template"
              />} @else {{{ item }}}
            </li>
          }
        </ol>
      } @case ("ul") {
        <ul
          class="tag-list"
          [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @for (item of items; track item) {
            <li>
              @if (this.defaultTemplate(); as template) {<ng-container
                [ngTemplateOutlet]="template"
              />} @else {{{ item }}}
            </li>
          }
        </ul>
      }
    }
    <ng-content select="[ufTagListDefault]" />
  `,
})
export default class TagList {
  readonly ordered = input.required<boolean>();
  readonly label = input.required<string>();
  readonly items = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly defaultTemplate = contentChild(TagListDefault, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLOListElement | HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
