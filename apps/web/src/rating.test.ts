import assert from "node:assert/strict";
import { test } from "node:test";
import { getStarSelectionValues } from "./rating";

test("rating choices start at one star and then allow half-stars", () => {
  assert.deepEqual(getStarSelectionValues(1), [1]);
  assert.deepEqual(getStarSelectionValues(2), [1.5, 2]);
  assert.deepEqual(getStarSelectionValues(5), [4.5, 5]);
});
