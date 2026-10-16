import Card, { CardTitle } from "./card";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-cards",
  imports: [Card, CardTitle],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="cards" [class]="this.class()" [style]="this.style()">
      <uf-card [label]="'Full'">
        <p>Sunny, 21°</p>
        <ng-template ufCardTitle>
          <h3>Weather</h3>
        </ng-template>
      </uf-card>
      <uf-card [label]="'Bare'" />
    </div>
  `,
})
export default class Cards {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
