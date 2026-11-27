import { Component } from "@angular/core";

import RowList, {
	RowListDefault,
} from "../../../../../integration/cases/slots/repeated-default/__output__/angular/row-list";

// `RowList`'s default slot passes no props, so a `let-` variable on its template is an error.
@Component({
	selector: "uf-row-list-misuse-slot",
	imports: [RowList, RowListDefault],
	template: `
		<uf-row-list label="Produce" [items]="['Apples', 'Pears']">
			<!-- @uf-expect TS2339 RowList.slot:default -->
			<ng-template ufRowListDefault let-props>{{ props }}</ng-template>
		</uf-row-list>
	`,
})
export default class MisuseSlot {}
