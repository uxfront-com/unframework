import KeepAlive from "./keep-alive";
import Transition from "./transition";
import TransitionComponent from "./transition-component";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-wizard",
  imports: [Transition, TransitionComponent, KeepAlive],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section aria-label="Wizard" [class]="this.class()" [style]="this.style()">
      <uf-transition [step]="'details'" />
      <uf-transition-component />
      <uf-keep-alive [level]="2" />
    </section>
  `,
})
export default class Wizard {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
