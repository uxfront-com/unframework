import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  type OnInit,
  inject,
  input,
  linkedSignal,
  untracked,
  viewChild,
} from "@angular/core";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

@Component({
  selector: "uf-profile-card",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let profile = this.profile();
    <article
      class="profile-card"
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ profile.name }}</h2>
      <p>{{ profile.title }}</p>
      <p role="status">{{ profile.available ? "Available" : "Away" }}</p>
      <button type="button" (click)="rename('Ada King')">Use married name</button>
      <button
        type="button"
        [attr.aria-pressed]="profile.available"
        (click)="toggleAvailability()"
      >Available</button>
    </article>
  `,
})
export default class ProfileCard implements OnInit {
  readonly initial = input.required<Profile>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly profile = linkedSignal(() => untracked(() => this.initial()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.profile();
  }

  protected rename(name: string) {
    this.profile.set({ ...this.profile(), name });
  }

  protected toggleAvailability() {
    this.profile.set({ ...this.profile(), available: !this.profile().available });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
