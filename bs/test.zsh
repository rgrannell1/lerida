#!/usr/bin/env zsh
# Run the unit test suite (top-level test/*_test.ts). The Playwright end-to-end
# suite under test/e2e/ needs a browser + more permissions — run bs/test:e2e.zsh.
exec deno test --allow-read test/*_test.ts
