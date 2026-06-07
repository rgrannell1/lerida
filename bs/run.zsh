#!/usr/bin/env zsh
# Build the bundle, then serve web/ locally on :8000.
./bs/build.zsh && exec deno run -A jsr:@std/http/file-server web --port 8000
