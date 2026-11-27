import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import EachSlot, { EachSlotRow } from "./each-slot";
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

/** A template of `EachAction`'s `default` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufEachActionDefault]" })
export class EachActionDefault {
  static ngTemplateContextGuard(
    _directive: EachActionDefault,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-each-action",
  imports: [EachSlot, EachSlotRow, NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let items = this.items();
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
          <uf-each-slot [items]="items">
            <ng-template ufEachSlotRow let-item="item">
              <span class="each-fill">
                @if (this.defaultTemplate(); as template) {<ng-container
                  [ngTemplateOutlet]="template"
                />} @else {{{ item }}}
              </span>
            </ng-template>
          </uf-each-slot>
        </a>
      } @case ("button") {
        <button
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          <uf-each-slot [items]="items">
            <ng-template ufEachSlotRow let-item="item">
              <span class="each-fill">
                @if (this.defaultTemplate(); as template) {<ng-container
                  [ngTemplateOutlet]="template"
                />} @else {{{ item }}}
              </span>
            </ng-template>
          </uf-each-slot>
        </button>
      }
    }
    <ng-content select="[ufEachActionDefault]" />
  `,
})
export default class EachAction {
  readonly href = input<string>();
  readonly items = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly defaultTemplate = contentChild(EachActionDefault, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement | HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
