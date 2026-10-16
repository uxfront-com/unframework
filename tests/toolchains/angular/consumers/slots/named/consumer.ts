import { Component } from "@angular/core";

import Card, {
  CardFooter,
  CardHeader,
} from "../../../../../integration/cases/slots/named/__output__/angular/card";

@Component({
  selector: "uf-card-consumer",
  imports: [Card, CardHeader, CardFooter],
  template: `
    <uf-card>
      <ng-template ufCardHeader><h2>Notes</h2></ng-template>
      <p>Body</p>
      <ng-template ufCardFooter><small>Footer</small></ng-template>
    </uf-card>
  `,
})
export default class Consumer {}
