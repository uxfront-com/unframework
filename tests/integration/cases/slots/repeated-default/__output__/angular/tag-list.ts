import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-tag-list",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let ordered = this.ordered();
    @let label = this.label();
    @let items = this.items();
    @switch (ordered ? "ol" : "ul") {
      @case ("ol") {
        <ol
          class="tag-list"
          [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @for (item of items; track item) {
            <li>
              <ng-content>{{ item }}</ng-content>
            </li>
          }
        </ol>
      } @case ("ul") {
        <ul
          class="tag-list"
          [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @for (item of items; track item) {
            <li>
              <ng-content>{{ item }}</ng-content>
            </li>
          }
        </ul>
      }
    }
  `,
})
export default class TagList {
  readonly ordered = input.required<boolean>();
  readonly label = input.required<string>();
  readonly items = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLOListElement | HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
