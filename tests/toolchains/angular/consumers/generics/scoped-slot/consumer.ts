import { Component } from "@angular/core";

import Picker, {
  PickerItem,
} from "../../../../../integration/cases/generics/scoped-slot/__output__/angular/picker";

@Component({
  selector: "uf-picker-consumer",
  imports: [Picker, PickerItem],
  template: `
    <uf-picker [items]="fruits">
      <ng-template ufPickerItem let-item="item">{{ item.name }} × {{ item.count }}</ng-template>
    </uf-picker>
  `,
})
export default class Consumer {
  protected readonly fruits = [{ name: "Apple", count: 3 }];
}
