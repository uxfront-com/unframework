import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

/** A template of `Box`'s `title` slot (ADR-0056). */
@Directive({ selector: "ng-template[ufBoxTitle]" })
export class BoxTitle {}

@Component({
  selector: "uf-box",
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="box" [class]="this.class()" [style]="this.style()">
      <h3>
        @if (titleTemplate(); as template) {<ng-container [ngTemplateOutlet]="template" />} @else {Untitled}
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
  protected readonly titleTemplate = contentChild(BoxTitle, { read: TemplateRef });
}
