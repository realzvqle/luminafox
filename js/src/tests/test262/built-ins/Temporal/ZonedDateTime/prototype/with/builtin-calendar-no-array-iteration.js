// |reftest| skip-if(!this.hasOwnProperty('Temporal')) -- Temporal is not enabled unconditionally
// Copyright (C) 2023 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-temporal.zoneddatetime.prototype.with
description: >
  Calling the method on an instance constructed with a builtin calendar causes
  no observable array iteration when getting the calendar fields.
features: [Temporal]
---*/

const arrayPrototypeSymbolIteratorOriginal = Array.prototype[Symbol.iterator];
Array.prototype[Symbol.iterator] = function arrayIterator() {
  throw new Test262Error("Array should not be iterated");
}

const instance = new Temporal.ZonedDateTime(1_000_000_000_000_000_000n, "UTC", "iso8601");
instance.with({ day: 5 });

Array.prototype[Symbol.iterator] = arrayPrototypeSymbolIteratorOriginal;

reportCompare(0, 0);
