#!/usr/bin/env zsh
# Rebuild the bundle on change.
exec deno run -A bs/build.ts --watch
