import Notice, { NoticeAction } from "./notice";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-board",
  imports: [Notice, NoticeAction],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let build = this.build();
    <div [class]="this.class()" [style]="this.style()">
      <uf-notice
        [label]="'Build'"
      >Build {{ build }} failed.<ng-template
        ufNoticeAction
      ><a href="#logs">See the logs</a></ng-template></uf-notice>
      <uf-notice [label]="'Deploy'" />
    </div>
  `,
})
export default class Board {
  readonly build = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
