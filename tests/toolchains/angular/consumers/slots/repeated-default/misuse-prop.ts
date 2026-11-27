import { Component } from "@angular/core";

import RowList, {
	RowListDefault,
} from "../../../../../integration/cases/slots/repeated-default/__output__/angular/row-list";

@Component({
	selector: "uf-row-list-misuse-prop",
	imports: [RowList, RowListDefault],
	template: `
		<!-- @uf-expect TS2322 RowList.prop:items -->
		<uf-row-list label="Produce" [items]="'Apples'">
			<ng-template ufRowListDefault><em>fresh</em></ng-template>
		</uf-row-list>
	`,
})
export default class MisuseProp {}
