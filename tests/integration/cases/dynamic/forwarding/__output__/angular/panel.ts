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

/** A template of `Panel`'s `title` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufPanelTitle]" })
export class PanelTitle {
  static ngTemplateContextGuard(
    _directive: PanelTitle,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-panel",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div
      class="panel"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h4>
        @if (this.titleTemplate(); as template) {<ng-container [ngTemplateOutlet]="template" />} @else {Untitled}
      </h4>
    </div>
    <ng-content select="[ufPanelTitle]" />
  `,
})
export default class Panel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly titleTemplate = contentChild(PanelTitle, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
