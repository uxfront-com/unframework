import Table, { TableRow } from "./table";
import { Component, input } from "@angular/core";

export interface Person {
  id: string;
  name: string;
}

@Component({
  selector: "uf-directory",
  imports: [Table, TableRow],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let people = this.people();
    <uf-table [people]="people" [class]="this.class()" [style]="this.style()">
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
}
