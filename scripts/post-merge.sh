#!/bin/bash
set -e

export PATH="$HOME/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"

cd /home/runner/workspace/frontend
yarn install --non-interactive --frozen-lockfile

cd /home/runner/workspace/backend
pip install -q -r requirements.txt
