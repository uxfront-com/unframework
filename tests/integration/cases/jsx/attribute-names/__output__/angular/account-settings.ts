import { Component, input } from "@angular/core";

export interface AccountSettingsProps {
  charset: string;
  bioId: string;
  bioLimit: number;
  locked: boolean;
  bannerCors: "anonymous" | "use-credentials";
  seatColumns: number;
  helpOrder: number;
}

@Component({
  selector: "uf-account-settings",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let charset = this.charset();
    @let bioId = this.bioId();
    @let bioLimit = this.bioLimit();
    @let locked = this.locked();
    @let bannerCors = this.bannerCors();
    @let seatColumns = this.seatColumns();
    @let helpOrder = this.helpOrder();
    <div class="account-settings">
      <form accept-charset="utf-8" aria-label="Profile">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23345'/%3E%3C/svg%3E"
          alt="Avatar"
          width="40"
          height="40"
          crossorigin="anonymous"
        />
        <label for="display-name">Display name</label>
        <input
          id="display-name"
          type="text"
          name="display-name"
          maxlength="40"
          readonly
          placeholder="Ada"
        />
        <label [attr.for]="bioId">Bio</label>
        <textarea
          [attr.id]="bioId"
          name="bio"
          rows="3"
          [attr.maxlength]="bioLimit"
          [attr.readonly]="locked ? '' : null"
        ></textarea>
        <button type="button" tabindex="0">Profile help</button>
      </form>
      <form [attr.accept-charset]="charset" aria-label="Plan">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Crect width='120' height='40' fill='%23563'/%3E%3C/svg%3E"
          alt="Team plan banner"
          width="120"
          height="40"
          [attr.crossorigin]="bannerCors"
        />
        <table>
          <tbody>
            <tr>
              <th scope="row">Plan</th>
              <td colspan="2">Team</td>
            </tr>
            <tr>
              <th scope="row">Seats</th>
              <td [attr.colspan]="seatColumns">12</td>
            </tr>
          </tbody>
        </table>
        <button type="button" [attr.tabindex]="helpOrder">Plan help</button>
      </form>
    </div>
  `,
})
export default class AccountSettings {
  readonly charset = input.required<string>();
  readonly bioId = input.required<string>();
  readonly bioLimit = input.required<number>();
  readonly locked = input.required<boolean>();
  readonly bannerCors = input.required<"anonymous" | "use-credentials">();
  readonly seatColumns = input.required<number>();
  readonly helpOrder = input.required<number>();
}
