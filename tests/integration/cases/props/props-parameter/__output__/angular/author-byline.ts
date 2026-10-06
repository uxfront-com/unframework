import { Component, input } from "@angular/core";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

@Component({
  selector: "uf-author-byline",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let author = this.author();
    @let published = this.published();
    @let minutes = this.minutes();
    @let affiliation = this.affiliation();
    <p
      class="byline"
    >By {{ author }}, {{ affiliation ?? "independent" }}<br /><time
      [attr.datetime]="published"
    >{{ published }}</time> · {{ minutes }} min read</p>
  `,
})
export default class AuthorByline {
  readonly author = input.required<string>();
  readonly published = input.required<string>();
  readonly minutes = input.required<number>();
  readonly affiliation = input<string>();
}
