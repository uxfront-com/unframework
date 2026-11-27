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

/** A template of `IconAction`'s `icon` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufIconActionIcon]" })
export class IconActionIcon {
  static ngTemplateContextGuard(
    _directive: IconActionIcon,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-icon-action",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let label = this.label();
    @switch (href ? "a" : "button") {
      @case ("a") {
        <a
          [attr.href]="'href' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['href'] : href"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @if (this.iconTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          } @else {
            <span>
              <ng-content>{{ label }}</ng-content>
            </span>
          }
        </a>
      } @case ("button") {
        <button
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @if (this.iconTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          } @else {
            <span>
              <ng-content>{{ label }}</ng-content>
            </span>
          }
        </button>
      }
    }
    <ng-content select="[ufIconActionIcon]" />
  `,
})
export default class IconAction {
  readonly href = input<string>();
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly iconTemplate = contentChild(IconActionIcon, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement | HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
