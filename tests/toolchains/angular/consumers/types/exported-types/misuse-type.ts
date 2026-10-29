import { Component } from "@angular/core";

import Button, {
  type ButtonProps,
  type ButtonSize,
} from "../../../../../integration/cases/types/exported-types/__output__/angular/button";

@Component({
  selector: "uf-button-misuse-type",
  imports: [Button],
  template: `<uf-button [label]="props.label" [attr.data-size]="size" />`,
})
export default class MisuseType {
  // @uf-expect TS2322 Button.type:ButtonProps
  protected readonly props: ButtonProps = { label: "Save", tone: "danger" };
  // @uf-expect TS2322 Button.type:ButtonSize
  protected readonly size: ButtonSize = "huge";
}
