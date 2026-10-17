import test from "node:test";
import assert from "node:assert/strict";
import { supportsNativeCustomTurns } from "./idle-wake.ts";

test("native custom turns require a released Pi 1.3+ host", () => {
  for (const version of ["1.3.0", "1.3.0-fork.1", "2.0.0"]) assert.equal(supportsNativeCustomTurns(version), true, version);
  for (const version of ["0.87.0", "1.2.0-fork.1", "1.3.0-rc.1", "unknown", ""]) assert.equal(supportsNativeCustomTurns(version), false, version);
});
