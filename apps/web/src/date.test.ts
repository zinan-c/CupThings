import assert from "node:assert/strict";
import { test } from "node:test";
import {
  endOfLocalDayIso,
  fromDateTimeLocalValue,
  startOfLocalDayIso,
  toDateTimeLocalValue
} from "./date";

test("local date range helpers include the whole selected day", () => {
  const date = "2026-07-15";
  const start = new Date(startOfLocalDayIso(date));
  const end = new Date(endOfLocalDayIso(date));

  assert.ok(end.getTime() > start.getTime());
  assert.equal(end.getTime() - start.getTime(), 86_399_999);
});

test("datetime-local values round-trip through ISO instants", () => {
  const value = toDateTimeLocalValue(new Date("2026-07-15T08:30:00.000Z"));
  const iso = fromDateTimeLocalValue(value);

  assert.equal(new Date(iso).toISOString(), new Date(value).toISOString());
});
