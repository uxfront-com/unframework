import { Component } from "@angular/core";

@Component({
  selector: "uf-transition-component",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <p class="note">Plain child</p>
  `,
})
export default class TransitionComponent {}
