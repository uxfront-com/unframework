import { Component, signal } from "@angular/core";

import Select from "../../../../../integration/cases/generics/select/__output__/angular/select";

@Component({
  selector: "uf-select-consumer",
  imports: [Select],
  template: `<uf-select [label]="'Size'" [options]="['s', 'm']" [(value)]="size" />`,
})
export default class Consumer {
  protected readonly size = signal<"s" | "m">("s");
}
