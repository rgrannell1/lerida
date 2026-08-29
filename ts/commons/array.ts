// General array operations.

import type { Maybe } from "../maybe.ts";

export function dropFrom<Item>(items: Maybe<Item[]>, item: Item): Item[] {
  return (items ?? []).filter((each) => each !== item);
}
