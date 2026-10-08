import { Component } from "@angular/core";

@Component({
  selector: "uf-stack",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <p>First</p>
    <p>Second</p>
  `,
})
export class Stack {}
