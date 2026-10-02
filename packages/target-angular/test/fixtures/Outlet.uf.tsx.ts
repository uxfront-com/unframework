// Named like the unframework plugin's Angular modules, so the toolchain's ngtsc plugin compiles
// it in the Vite server, as it compiles every component of an ssr:angular project. It needs
// @angular/common, which Node cannot load as published without the JIT compiler.
import { NgTemplateOutlet } from "@angular/common";
import { Component } from "@angular/core";

@Component({
  selector: "uf-outlet",
  host: { style: "display: contents" },
  imports: [NgTemplateOutlet],
  template: `<ng-container *ngTemplateOutlet="content" /><ng-template #content
      ><p>x</p></ng-template
    >`,
})
export default class Outlet {}
