import { Component, signal } from "@angular/core";

import Select from "../../../../../integration/cases/generics/select/__output__/angular/select";

@Component({
  selector: "uf-select-misuse-model",
  imports: [Select],
  template: `
    <!-- @uf-expect TS2322 Select.model:value -->
    <uf-select [label]="'Size'" [options]="['s', 'm']" [(value)]="count" />
  `,
})
export default class MisuseModel {
  protected readonly count = signal(1);
}
