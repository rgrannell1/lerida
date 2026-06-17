#!/usr/bin/env zsh
# Build the static app and deploy it to Cloudflare Pages via wrangler, together
# with the image-render Function (functions/) and its browser binding (from
# wrangler.toml). Pass extra wrangler args through, e.g. `bs/deploy.zsh --branch main`
# to publish to production.
#
# Prerequisites: `wrangler login`, Browser Rendering enabled on the account
# (Workers Paid plan), and the `name` in wrangler.toml matching the Pages project.
set -e

# 1. Build the bundle (web/dist, web/index.html, web/sw.js are gitignored).
./bs/build.zsh

# 2. Ensure the Function's npm dep (@cloudflare/puppeteer) is present so wrangler
#    can bundle functions/.
if [[ ! -d node_modules/@cloudflare/puppeteer ]]; then
  npm install
fi

# 3. Deploy static assets + functions/ + bindings.
exec npx wrangler pages deploy web "$@"
