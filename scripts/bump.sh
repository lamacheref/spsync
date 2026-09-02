#!/usr/bin/env bash
set -euo pipefail
# bump.sh — M.m.f versioning pour spsync
# Usage: ./scripts/bump.sh [major|minor|patch]
#  - patch (défaut) : bump f à chaque commit
#  - minor : bump m + reset f (feature)
#  - major : bump M + reset m,f (PR utilisateur uniquement)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$ROOT/VERSION"
MANIFEST="$ROOT/manifest.json"

MODE="${1:-patch}"

if [[ ! -f "$VERSION_FILE" ]]; then
  echo "VERSION file not found at $VERSION_FILE" >&2
  exit 1
fi

VER=$(tr -d ' \n\r' < "$VERSION_FILE")
if ! [[ "$VER" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Invalid VERSION format: $VER (expected M.m.f)" >&2
  exit 1
fi
M="${BASH_REMATCH[1]}"
m="${BASH_REMATCH[2]}"
f="${BASH_REMATCH[3]}"

case "$MODE" in
  patch)
    f=$((f+1))
    ;;
  minor)
    m=$((m+1)); f=0
    ;;
  major)
    M=$((M+1)); m=0; f=0
    echo "⚠️  Major bump — doit être justifié dans une PR utilisateur" >&2
    ;;
  *)
    echo "Usage: $0 [major|minor|patch]" >&2
    exit 1
    ;;
esac

NEW_VER="${M}.${m}.${f}"
echo "$NEW_VER" > "$VERSION_FILE"
echo "VERSION: $VER → $NEW_VER ($MODE)"

# Sync manifest.json if exists
if [[ -f "$MANIFEST" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json
with open('$MANIFEST','r') as f: data=json.load(f)
data['version']='$NEW_VER'
with open('$MANIFEST','w') as f: json.dump(data,f,indent=2); f.write('\n')
print('manifest.json version synced')
"
  else
    # fallback sed
    sed -i -E "s/\"version\": *\"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$NEW_VER\"/" "$MANIFEST"
    echo "manifest.json version synced (sed fallback)"
  fi
  git add "$MANIFEST" 2>/dev/null || true
fi

git add "$VERSION_FILE" 2>/dev/null || true
