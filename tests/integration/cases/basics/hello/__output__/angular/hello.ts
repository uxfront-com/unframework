import { Component } from "@angular/core";

@Component({
  selector: "uf-hello",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <p class="greeting">Hello, world!</p>
  `,
})
export default class Hello {}
