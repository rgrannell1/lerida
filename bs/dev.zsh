#!/usr/bin/env zsh
# Dev loop: rebuild the bundle on change AND serve web/ on :8000.
deno run -A bs/build.ts --watch &
ESBUILD_PID=$!
trap "kill $ESBUILD_PID 2>/dev/null" EXIT INT TERM
exec deno run -A jsr:@std/http/file-server web --port 8000
