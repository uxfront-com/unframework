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

/** A template of `Box`'s `title` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufBoxTitle]" })
export class BoxTitle {
  static ngTemplateContextGuard(
    _directive: BoxTitle,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-box",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div
      class="box"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h3>
        @if (this.titleTemplate(); as template) {<ng-container [ngTemplateOutlet]="template" />} @else {Untitled}
      </h3>
      <ng-content>
        <p>No content</p>
      </ng-content>
    </div>
    <ng-content select="[ufBoxTitle]" />
  `,
})
export default class Box {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly titleTemplate = contentChild(BoxTitle, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
