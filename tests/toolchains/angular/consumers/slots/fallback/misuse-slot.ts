import { Component } from "@angular/core";

import Notice, {
  NoticeAction,
} from "../../../../../integration/cases/slots/fallback/__output__/angular/notice";

@Component({
  selector: "uf-notice-misuse-slot",
  imports: [Notice, NoticeAction],
  template: `
    <uf-notice [label]="'Build'">
      <!-- @uf-expect TS2339 Notice.slot:action -->
      <ng-template ufNoticeAction let-props>{{ props }}</ng-template>
    </uf-notice>
  `,
})
export default class MisuseSlot {}
