// A Deno CLI that turns a map-state JSON object into a shareable lerida URL,
// accepting or rejecting the input against the canonical schema. The state is
// read from a file argument or stdin; a valid state prints its full URL to
// stdout, an invalid state prints schema errors to stderr and exits non-zero.
//
// The pure buildUrl() below carries all the logic so tests can exercise it
// directly; main() only handles argv and IO and runs under import.meta.main.

// @deno-types="npm:ajv@^8.17.1/dist/2020.d.ts"
import { Ajv2020, type ErrorObject } from "ajv/2020";
import { type StateObject } from "cycle";
import { MAP_SCHEMA } from "./schema.ts";
import { encodeUrl } from "./url.ts";
import type { MapState } from "./types.ts";

// The default host shareable links point at; overridable with --base.
const DEFAULT_BASE = "https://lerida.rho.ie";

// The schema document carries a `$schema` meta URI (draft 2023-02) that ajv's
// 2020 build does not recognise; drop it so compilation uses ajv's own 2020-12
// meta-schema, which understands the `$defs`/`$ref`/additionalProperties we use.
function schemaForAjv(): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = MAP_SCHEMA as Record<string, unknown>;
  return rest;
}

// Compile once; the validator is pure and reused across buildUrl() calls.
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateState = ajv.compile(schemaForAjv());

// Turn one ajv error into a readable "path: message (detail)" line. The empty
// instancePath (a top-level problem) is shown as "(root)" so it is not blank.
function formatError(error: ErrorObject): string {
  const path = error.instancePath === "" ? "(root)" : error.instancePath;
  const extra = error.params?.additionalProperty
    ? ` (${error.params.additionalProperty})`
    : "";
  return `${path}: ${error.message ?? "is invalid"}${extra}`;
}

// Join a base host and an encoded query into a full URL. An empty query (from an
// empty but valid state) yields just "<base>/"; the base's trailing slash, if
// any, is normalised away first so we never emit a double slash.
function joinUrl(base: string, query: string): string {
  const root = base.replace(/\/+$/, "");
  return query === "" ? `${root}/` : `${root}/?${query}`;
}

// The result of building a URL: either an accepted URL or the schema errors that
// rejected the input.
export type BuildResult =
  | { ok: true; url: string }
  | { ok: false; errors: string[] };

// Validate `state` against the canonical schema and, if it conforms, build its
// shareable URL under `base`. Pure: no IO, no process exit.
export function buildUrl(state: unknown, base: string = DEFAULT_BASE): BuildResult {
  if (!validateState(state)) {
    const errors = (validateState.errors ?? []).map(formatError);
    return { ok: false, errors: errors.length > 0 ? errors : ["invalid state"] };
  }
  const query = encodeUrl(state as MapState as unknown as StateObject);
  return { ok: true, url: joinUrl(base, query) };
}

// Read all of stdin as text (used when no file path is given). Wrapping the
// readable in a Response drains the whole stream without manual chunk handling.
async function readStdin(): Promise<string> {
  return await new Response(Deno.stdin.readable).text();
}

// Parse argv into a base override and an optional input file path. Unknown flags
// are treated as errors so typos are not silently ignored.
function parseArgs(args: string[]): { base: string; file?: string } {
  let base = DEFAULT_BASE;
  let file: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--base") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("--base needs a URL argument");
      }
      base = value;
      index++;
    } else if (arg.startsWith("--base=")) {
      base = arg.slice("--base=".length);
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown flag: ${arg}`);
    } else {
      file = arg;
    }
  }
  return { base, file };
}

// The IO shell: read state JSON from the file or stdin, validate, and either
// print the URL (exit 0) or print errors to stderr (exit 1).
async function main(): Promise<void> {
  let parsed: { base: string; file?: string };
  try {
    parsed = parseArgs(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(2);
  }

  const source = parsed.file ? await Deno.readTextFile(parsed.file) : await readStdin();

  let state: unknown;
  try {
    state = JSON.parse(source);
  } catch (error) {
    console.error(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }

  const result = buildUrl(state, parsed.base);
  if (result.ok) {
    console.log(result.url);
    return;
  }
  console.error("state rejected by schema:");
  for (const line of result.errors) {
    console.error(`  ${line}`);
  }
  Deno.exit(1);
}

if (import.meta.main) {
  await main();
}
