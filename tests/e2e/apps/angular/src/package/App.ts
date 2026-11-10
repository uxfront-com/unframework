import { Component } from "@angular/core";

import { Hello } from "./Hello.ts";
import { Showcase } from "./Showcase.ts";

@Component({
  selector: "app-root",
  imports: [Hello, Showcase],
  template: "<app-hello /><app-showcase />",
})
export class App {}
