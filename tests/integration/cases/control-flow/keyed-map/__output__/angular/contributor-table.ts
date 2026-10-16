import { Component, input } from "@angular/core";

export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

@Component({
  selector: "uf-contributor-table",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let caption = this.caption();
    @let contributors = this.contributors();
    <table class="contributors" [class]="this.class()" [style]="this.style()">
      <caption>{{ caption }}</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Commits</th>
        </tr>
      </thead>
      <tbody>
        @for (contributor of contributors; track contributor.login) {
          <tr>
            <td>
              <a
                [attr.href]="'https://example.com/people/' + contributor.login"
              >{{ contributor.name }}</a>
            </td>
            <td>{{ contributor.commits }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export default class ContributorTable {
  readonly caption = input.required<string>();
  readonly contributors = input.required<Contributor[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
