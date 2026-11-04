import { Component } from "@angular/core";

import Button, {
  type ButtonProps,
  type ButtonSize,
} from "../../../../../integration/cases/types/exported-types/__output__/angular/button";

@Component({
  selector: "uf-button-consumer",
  imports: [Button],
  template: `<uf-button [label]="props.label" [tone]="props.tone" [attr.data-size]="size" />`,
})
export default class Consumer {
  protected readonly props: ButtonProps = { label: "Save", tone: "secondary" };
  protected readonly size: ButtonSize = "large";
}
