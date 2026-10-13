import { Component, input } from "@angular/core";

@Component({
  selector: "uf-profile-card",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <article
      class="profile"
      aria-labelledby="profile-name"
      [class]="this.class()"
      [style]="this.style()"
    >
      <header class="profile-header">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23345'/%3E%3C/svg%3E"
          alt="Ada's avatar"
          width="48"
          height="48"
        />
        <h2 id="profile-name">Ada Lovelace</h2>
      </header>
      <p>Mathematician &amp; writer<br />of the first published program</p>
      <hr />
      <label for="profile-note">Note</label>
      <input id="profile-note" type="text" name="note" placeholder="Say hello" />
    </article>
  `,
})
export default class ProfileCard {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
