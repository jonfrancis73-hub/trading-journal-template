#!/bin/bash
# Finder does not inherit Terminal's PATH. Support standard Node installations.
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/share/fnm/aliases/default/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js is missing. Install the current LTS version from https://nodejs.org, then try again.' >&2
  exit 1
fi
exec node "$(cd "$(dirname "$0")" && pwd)/launcher.mjs" "${1:-start}"
