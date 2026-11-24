import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Table, { TableRow } from "./table";
import { Component, ElementRef, computed, inject, input, viewChild } from "@angular/core";

export interface Person {
  id: string;
  name: string;
}

@Component({
  selector: "uf-directory",
  imports: [Table, TableRow, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let people = this.people();
    <uf-table
      [people]="people"
      [class]="this.class()"
      [style]="this.style()"
      [ufAttributes]="this.ufAttributes()"
      [ufListeners]="this.ufListeners()"
      [ufScope]="this.host"
      #ufElement
    >
      <ng-template ufTableRow let-name="name" let-id="dataId" let-index="index">
        <span>{{ index + 1 }}: {{ name }} ({{ id }})</span>
      </ng-template>
    </uf-table>
  `,
})
export default class Directory {
  readonly people = input.required<Person[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly rootComponent = viewChild("ufElement", { read: Table });
  readonly ufElement = computed(() => this.rootComponent()?.ufElement());
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
