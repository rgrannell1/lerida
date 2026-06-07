// The single canonical cycle schema for lerida map state, plus the codec built
// from it. The schema document lives in data/schema.json; this module loads it
// and compiles the codec. Every lerida URL conforms to this schema; cycle handles
// the URL↔state bijection against it.

import { createCodec, type JsonSchema } from "cycle";
import schemaJson from "../data/schema.json" with { type: "json" };

// The map-state schema, loaded from data/schema.json.
export const MAP_SCHEMA = schemaJson as unknown as JsonSchema;

// The codec instance — compiled once, shared across the app.
export const codec = createCodec(MAP_SCHEMA);
