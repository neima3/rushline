import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { raceValidated, validationHint, validationLabel } from "./validate.ts";

describe("raceValidated", () => {
  it("is a soft local flag: clean if rewind was never used", () => {
    assert.equal(raceValidated(false), true);
    assert.equal(raceValidated(true), false);
  });
});

describe("validation copy", () => {
  it("stays local and does not claim online anti-cheat", () => {
    assert.equal(validationLabel(true), "Validated");
    assert.equal(validationLabel(false), "Rewound");
    assert.match(validationHint(true), /local badge/i);
    assert.match(validationHint(true), /not online/i);
    assert.match(validationHint(false), /Rewind was used/i);
  });
});
