// A Styleframe configuration flagged as Pro, as a Pro composable flags the instance it extends
// (`markInstanceLicenseRequired` in @styleframe/license, which sets this property): a production
// build of it needs a licence key, so `styleframe.unit.test.ts` sees the build fail without one.
import { styleframe } from "styleframe";

const s = styleframe();
s.variable("color.primary", "rgb(29, 78, 216)");
Object.defineProperty(s, "__licenseRequired", { value: true, enumerable: true });

export default s;
