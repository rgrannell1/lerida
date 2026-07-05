#!/usr/bin/env zsh
# Build a shareable lerida URL from a map-state JSON file (or stdin), validating
# it against the schema. Args pass through: a file path and/or --base <url>.
exec deno run --allow-read ts/cli.ts "$@"
