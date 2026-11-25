import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Frame, { FrameTitle } from "./frame";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-gallery",
  imports: [Frame, FrameTitle, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-frame [label]="'Card'" [wide]="false">
        <ng-template ufFrameTitle>Sunset</ng-template>
      </uf-frame>
      <uf-frame [label]="'Panel'" [wide]="true">
        <ng-template ufFrameTitle>Dawn</ng-template>
      </uf-frame>
      <uf-frame [label]="'Empty'" [wide]="true" />
    </div>
  `,
})
export default class Gallery {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
