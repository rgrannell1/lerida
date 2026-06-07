#!/usr/bin/env zsh
# Build the bundle, then run the Playwright end-to-end suite against it. The tests
# launch a real Chromium (resolved from the ms-playwright cache, a LERIDA_CHROMIUM
# override, or the system Chrome) and serve web/ on an ephemeral port.
./bs/build.zsh && exec deno test -A test/e2e/
