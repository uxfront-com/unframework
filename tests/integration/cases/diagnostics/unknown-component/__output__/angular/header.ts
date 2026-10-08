import { Component } from "@angular/core";

@Component({
  selector: "uf-header",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <header class="header">Site</header>
  `,
})
export class Header {}
