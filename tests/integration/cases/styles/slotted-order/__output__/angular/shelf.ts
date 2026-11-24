import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Amber from "./amber";
import Blue from "./blue";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-shelf",
  imports: [Blue, Amber, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-blue>
        <p class="caption" data-uf-721c504a-s="">In blue</p>
      </uf-blue>
      <uf-amber>
        <p class="caption" data-uf-c97301b3-s="">In amber</p>
      </uf-amber>
      @for (item of items; track item.label) {
        <div>
          @switch (item.warm ? "Amber" : "Blue") {
            @case ("Amber") {
              <uf-amber>
                <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">{{ item.label }}</p>
              </uf-amber>
            } @case ("Blue") {
              <uf-blue>
                <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">{{ item.label }}</p>
              </uf-blue>
            }
          }
        </div>
      }
    </section>
  `,
})
export default class Shelf {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly items = [
    { label: "Warm", warm: true },
    { label: "Cool", warm: false },
  ];
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
