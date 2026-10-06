import { Component } from "@angular/core";

@Component({
  selector: "uf-card",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <p>Card</p>
  `,
})
export class Card {}
