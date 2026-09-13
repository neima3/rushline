/** Local time-trial validation — rewind used or not. Not online anti-cheat. */

export function raceValidated(usedRewind: boolean): boolean {
  return usedRewind !== true;
}

export function validationLabel(validated: boolean): "Validated" | "Rewound" {
  return validated ? "Validated" : "Rewound";
}

export function validationHint(validated: boolean): string {
  return validated
    ? "No rewind this run — a local badge, not online anti-cheat"
    : "Rewind was used — the time still counts for PB and medals";
}
