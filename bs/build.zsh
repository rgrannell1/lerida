#!/usr/bin/env zsh
# Bundle the app to web/dist/ via the Deno-aware esbuild script.
exec deno run -A bs/build.ts
