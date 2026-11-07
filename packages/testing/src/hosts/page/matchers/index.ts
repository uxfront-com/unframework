// The `expect.element` matchers the corpus uses, ported from Vitest 5.0.3's browser client
// (`vitest-dev/vitest@v5.0.3`, packages/browser/src/client/tester/expect), which ported them from
// jest-dom. Each keeps Vitest's verdict and message, which L8 records (`test/page-host.test.ts`
// compares both with what Vitest gives). Any other of Vitest's element matchers fails with chai's
// "Invalid Chai property" on the page host alone, so a new one gets ported here first. A matcher of
// chai's or `@vitest/expect`'s runs on the element, as on Vitest.
//
// Vitest: MIT License, Copyright (c) 2021-Present VoidZero Inc. and Vitest contributors. jest-dom:
// the MIT notice each file holds.
import type { MatchersObject } from "@vitest/expect";

import toBeChecked from "./toBeChecked.ts";
import { toBeDisabled, toBeEnabled } from "./toBeEnabled.ts";
import toBeInTheDocument from "./toBeInTheDocument.ts";
import toBeRequired from "./toBeRequired.ts";
import toBeVisible from "./toBeVisible.ts";
import toHaveAccessibleDescription from "./toHaveAccessibleDescription.ts";
import toHaveAttribute from "./toHaveAttribute.ts";
import toHaveClass from "./toHaveClass.ts";
import toHaveFocus from "./toHaveFocus.ts";
import toHaveStyle from "./toHaveStyle.ts";
import toHaveTextContent from "./toHaveTextContent.ts";
import toHaveValue from "./toHaveValue.ts";
import toMatchTextContent from "./toMatchTextContent.ts";

/** The 14 matchers, by name. */
export const matchers: MatchersObject = {
  toBeChecked,
  toBeDisabled,
  toBeEnabled,
  toBeInTheDocument,
  toBeRequired,
  toBeVisible,
  toHaveAccessibleDescription,
  toHaveAttribute,
  toHaveClass,
  toHaveFocus,
  toHaveStyle,
  toHaveTextContent,
  toHaveValue,
  toMatchTextContent,
};
