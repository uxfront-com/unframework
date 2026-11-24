import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import List, { ListItem } from "./list";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-ranking",
  imports: [List, ListItem, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let names = this.names();
    <div
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-list [items]="names" [label]="'Podium'">
        <ng-template ufListItem let-item="item" let-index="index">
          <span>{{ index + 1 }}. <b>{{ item }}</b></span>
        </ng-template>
      </uf-list>
      <uf-list [items]="names" [label]="'Initials'">
        <ng-template ufListItem let-entry>
          <i>{{ entry.item.slice(0, 1) }}</i>
        </ng-template>
      </uf-list>
    </div>
  `,
})
export default class Ranking {
  readonly names = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
