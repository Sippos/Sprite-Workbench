#!/bin/bash
export PATH="$HOME/.cargo/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export WEBKIT_DISABLE_COMPOSITING_MODE=1

cd "$(dirname "$0")" || exit 1

npm run tauri dev > /tmp/asset-workbench-launch.log 2>&1
