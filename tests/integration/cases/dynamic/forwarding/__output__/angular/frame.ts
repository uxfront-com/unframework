import Card, { CardTitle } from "./card";
import Panel, { PanelTitle } from "./panel";
import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

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
  imports: [Panel, Card, PanelTitle, CardTitle, NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let wide = this.wide();
    <section class="frame" [attr.aria-label]="label" [class]="this.class()" [style]="this.style()">
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
  protected readonly titleTemplate = contentChild(FrameTitle, { read: TemplateRef });
}
