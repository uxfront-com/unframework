import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Names, { NamesDefault } from "./names";
import { Component, ElementRef, computed, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-roster",
  imports: [Names, NamesDefault, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let names = this.names();
    <uf-names
      [names]="names"
      [class]="this.class()"
      [style]="this.style()"
      [ufAttributes]="this.ufAttributes()"
      [ufListeners]="this.ufListeners()"
      [ufScope]="this.host"
      #ufElement
    >
      <ng-template ufNamesDefault let-item="item">
        <b>{{ item }}!</b>
      </ng-template>
    </uf-names>
  `,
})
export default class Roster {
  readonly names = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly rootComponent = viewChild("ufElement", { read: Names });
  readonly ufElement = computed(() => this.rootComponent()?.ufElement());
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
