import { Component, type OnInit, computed, input, untracked } from "@angular/core";

export interface WelcomeBannerProps {
  name: string;
}

@Component({
  selector: "uf-welcome-banner",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let greeting = this.greeting();
    <section class="welcome-banner" aria-label="Welcome">
      <h2>{{ greeting }}</h2>
      <p>Signed in as {{ name }}</p>
      <ul>
        @for (tip of tips; track tip) {
          <li>{{ tip }}</li>
        }
      </ul>
    </section>
  `,
})
export default class WelcomeBanner implements OnInit {
  readonly name = input.required<string>();
  protected readonly greeting = computed(() => untracked(() => `Welcome, ${this.name()}`));
  protected readonly tips = ["Set up your profile", "Invite your team"];

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.greeting();
  }
}
