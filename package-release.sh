#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_PATH="${1:-"${PROJECT_ROOT}/../ProceduralFieldMaker_release.zip"}"
OUTPUT_DIR="$(dirname "$OUTPUT_PATH")"
mkdir -p "$OUTPUT_DIR"

cd "$PROJECT_ROOT"
rm -f "$OUTPUT_PATH"
zip -r -X "$OUTPUT_PATH" . \
  -x 'Assets/CURRENT LOGO.png' \
     '*/Assets/CURRENT LOGO.png' \
     '.DS_Store' \
     '*/.DS_Store' \
     'ProceduralFieldMaker_release.zip'

printf 'Release creado: %s\n' "$OUTPUT_PATH"
