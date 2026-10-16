import { Component } from "@angular/core";

import Notice, {
  NoticeAction,
} from "../../../../../integration/cases/slots/fallback/__output__/angular/notice";

@Component({
  selector: "uf-notice-consumer",
  imports: [Notice, NoticeAction],
  template: `
    <uf-notice [label]="'Build'">
      Build failed.
      <ng-template ufNoticeAction><a href="#logs">See the logs</a></ng-template>
    </uf-notice>
  `,
})
export default class Consumer {}
