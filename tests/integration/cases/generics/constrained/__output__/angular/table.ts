import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

@Component({
  selector: "uf-table",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let caption = this.caption();
    @let rows = this.rows();
    <table
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <caption>{{ caption }}</caption>
      <tbody>
        @for (row of rows; track row.id) {
          <tr>
            <th scope="row">{{ row.id }}</th>
            <td>{{ row.label }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export default class Table<T extends { id: string; label: string }> {
  readonly caption = input.required<string>();
  readonly rows = input.required<T[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLTableElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
