// A Deno CLI that converts between a map-state JSON object and a shareable lerida
// URL, both directions gated by the canonical schema. Encode (default): read a
// state from a file argument or stdin; a valid state prints its full URL, an
// invalid one prints schema errors and exits non-zero. Decode (--decode): read a
// lerida URL from an argument or stdin and print its state JSON, rejecting a URL
// that decodes to a non-conforming state.
//
// The pure buildUrl()/decodeState() below carry all the logic so tests can
// exercise them directly; main() only handles argv and IO and runs under
// import.meta.main.

// @deno-types="npm:ajv@^8.17.1/dist/2020.d.ts"
import { Ajv2020, type ErrorObject } from "ajv/2020";
import { type StateObject } from "cycle";
import { MAP_SCHEMA } from "./schema.ts";
import { decodeUrl, encodeUrl } from "./url.ts";
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

// The result of decoding a URL: either the recovered state or the schema errors
// that rejected it.
export type DecodeResult =
  | { ok: true; state: MapState }
  | { ok: false; errors: string[] };

// Decode a lerida URL back into its map state, then hold the result to the same
// schema encode does. Accepts a full URL, a bare "?..." query, or a raw "c=..."
// value: the query is whatever follows the first "?" (or the whole string if it
// has none), which decodeUrl handles for both the compressed and legacy forms.
export function decodeState(input: string): DecodeResult {
  const trimmed = input.trim();
  const queryStart = trimmed.indexOf("?");
  const query = queryStart >= 0 ? trimmed.slice(queryStart + 1) : trimmed;
  let state: MapState;
  try {
    state = decodeUrl(query);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`could not decode URL: ${reason}`] };
  }
  if (!validateState(state)) {
    const errors = (validateState.errors ?? []).map(formatError);
    return { ok: false, errors: errors.length > 0 ? errors : ["decoded state is invalid"] };
  }
  return { ok: true, state };
}

// Read all of stdin as text (used when no file path is given). Wrapping the
// readable in a Response drains the whole stream without manual chunk handling.
async function readStdin(): Promise<string> {
  return await new Response(Deno.stdin.readable).text();
}

// The parsed command line: the encode base, the optional positional input (a
// state file when encoding, a URL literal when decoding), and the direction.
interface ParsedArgs {
  base: string;
  input?: string;
  decode: boolean;
}

// Parse argv into the base override, direction and positional input. Unknown
// flags are treated as errors so typos are not silently ignored.
function parseArgs(args: string[]): ParsedArgs {
  let base = DEFAULT_BASE;
  let input: string | undefined;
  let decode = false;
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
    } else if (arg === "--decode") {
      decode = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown flag: ${arg}`);
    } else {
      input = arg;
    }
  }
  return { base, input, decode };
}

// Print an error headline and its indented detail lines to stderr, then exit 1.
function reportErrors(headline: string, errors: string[]): never {
  console.error(headline);
  for (const line of errors) {
    console.error(`  ${line}`);
  }
  Deno.exit(1);
}

// Encode direction: read state JSON from the file or stdin, validate, and either
// print the URL (exit 0) or print schema errors (exit 1).
async function runEncode(file: string | undefined, base: string): Promise<void> {
  const source = file ? await Deno.readTextFile(file) : await readStdin();
  let state: unknown;
  try {
    state = JSON.parse(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`invalid JSON: ${reason}`);
    Deno.exit(1);
  }
  const result = buildUrl(state, base);
  if (result.ok) {
    console.log(result.url);
    return;
  }
  reportErrors("state rejected by schema:", result.errors);
}

// Decode direction: read a lerida URL from the argument or stdin and print its
// state JSON (exit 0), or print schema errors (exit 1).
async function runDecode(input: string | undefined): Promise<void> {
  const urlText = input ?? await readStdin();
  const result = decodeState(urlText);
  if (result.ok) {
    console.log(JSON.stringify(result.state, null, 2));
    return;
  }
  reportErrors("URL rejected by schema:", result.errors);
}

// The IO shell: parse argv, then run the chosen direction.
async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(2);
  }

  if (parsed.decode) {
    await runDecode(parsed.input);
    return;
  }
  await runEncode(parsed.input, parsed.base);
}

if (import.meta.main) {
  await main();
}
