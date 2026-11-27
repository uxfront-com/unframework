import { Component } from "@angular/core";

import RowList, {
	RowListDefault,
} from "../../../../../integration/cases/slots/repeated-default/__output__/angular/row-list";

// `RowList` renders its default slot in each row, so a consumer passes it as a template, which
// each row renders (ADR-0126).
@Component({
	selector: "uf-row-list-consumer",
	imports: [RowList, RowListDefault],
	template: `
		<uf-row-list label="Produce" [items]="['Apples', 'Pears']">
			<ng-template ufRowListDefault><em>fresh</em></ng-template>
		</uf-row-list>
	`,
})
export default class Consumer {}
