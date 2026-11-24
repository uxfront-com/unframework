import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Card, { CardTitle } from "./card";
import Panel, { PanelTitle } from "./panel";
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

/** A template of `Frame`'s `title` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufFrameTitle]" })
export class FrameTitle {
  static ngTemplateContextGuard(
    _directive: FrameTitle,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-frame",
  imports: [Panel, Card, PanelTitle, CardTitle, NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let wide = this.wide();
    <section
      class="frame"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @switch (wide ? "Panel" : "Card") {
        @case ("Panel") {
          <uf-panel>
            @if (this.titleTemplate(); as template) {
              <ng-template ufPanelTitle>
                <ng-container [ngTemplateOutlet]="template" />
              </ng-template>
            }
          </uf-panel>
        } @case ("Card") {
          <uf-card>
            @if (this.titleTemplate(); as template) {
              <ng-template ufCardTitle>
                <ng-container [ngTemplateOutlet]="template" />
              </ng-template>
            }
          </uf-card>
        }
      }
    </section>
    <ng-content select="[ufFrameTitle]" />
  `,
})
export default class Frame {
  readonly label = input.required<string>();
  readonly wide = input.required<boolean>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly titleTemplate = contentChild(FrameTitle, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
