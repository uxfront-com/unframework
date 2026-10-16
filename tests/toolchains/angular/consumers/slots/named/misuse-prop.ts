import { Component } from "@angular/core";

import Post from "../../../../../integration/cases/slots/named/__output__/angular/post";

@Component({
  selector: "uf-post-misuse-prop",
  imports: [Post],
  template: `
    <!-- @uf-expect TS2322 Post.prop:author -->
    <uf-post [author]="42" />
  `,
})
export default class MisuseProp {}
