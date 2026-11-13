// The report's browser tests render no target, so they take the testing package's matchers alone,
// not its setup file, which needs a harness's cases.
import { installMatchers } from "@unframework.dev/testing/harness";

installMatchers();
