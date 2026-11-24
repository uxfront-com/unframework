import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Frame, { FrameLabel } from "./frame";
import Mat from "./mat";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-gallery",
  imports: [Frame, Mat, FrameLabel, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let matted = this.matted();
    <section
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-frame>
        <p class="caption" data-uf-9dc516fd-s="">A quiet harbour</p>
      </uf-frame>
      <uf-frame>
        <ng-template ufFrameLabel let-text="text">
          <p class="caption" data-uf-9dc516fd-s="">{{ text }}</p>
        </ng-template>
      </uf-frame>
      @switch (matted ? "Mat" : "Frame") {
        @case ("Mat") {
          <uf-mat>
            <p class="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">A matted print</p>
          </uf-mat>
        } @case ("Frame") {
          <uf-frame>
            <p class="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">A matted print</p>
          </uf-frame>
        }
      }
      <p class="caption">Outside the frame</p>
    </section>
  `,
})
export default class Gallery {
  readonly matted = input<boolean, boolean | undefined>(true, {
    transform: (value) => (value === undefined ? true : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
