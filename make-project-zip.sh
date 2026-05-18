#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ============================================================
# make-project-zip.sh
# Creates a clean project archive for review/deployment analysis.
#
# Intended for Git Bash on Windows.
#
# Usage:
#   ./make-project-zip.sh
#
# Output:
#   ./_export/shot-tracker-project_YYYY-MM-DD_HH-MM-SS.zip
# ============================================================

PROJECT_NAME="shot-tracker-project"
STAMP="$(date +"%Y-%m-%d_%H-%M-%S")"

# ------------------------------------------------------------
# 1. Verify we are inside a Git repository
# ------------------------------------------------------------
if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "ERROR: This script must be run inside a Git repository."
    exit 1
fi

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

EXPORT_DIR="$PROJECT_ROOT/_export"
TMP_DIR="$(mktemp -d)"
STAGE_DIR="$TMP_DIR/$PROJECT_NAME"
ZIP_PATH="$EXPORT_DIR/${PROJECT_NAME}_${STAMP}.zip"

mkdir -p "$EXPORT_DIR"
mkdir -p "$STAGE_DIR"

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Project root: $PROJECT_ROOT"
echo "Export dir:   $EXPORT_DIR"
echo "ZIP path:     $ZIP_PATH"
echo

# ------------------------------------------------------------
# 2. Required files check
# ------------------------------------------------------------
REQUIRED_FILES=(
    "Dockerfile"
    ".dockerignore"
    ".gitignore"
    "make-project-zip.sh"

    "backend/package.json"
    "backend/package-lock.json"

    "frontend/README.md"
    "frontend/package.json"
    "frontend/package-lock.json"
    "frontend/index.html"
    "frontend/manifest.json"
    "frontend/offline.html"
    "frontend/sw.js"
    "frontend/vitest.config.js"
    "frontend/src/js/syncController.js"
    "frontend/tests/syncController.test.js"

    "frontend/src/css/styles.css"
    "frontend/src/images/goal-background.png"

    "frontend/src/js/app.js"
    "frontend/src/js/sevenM.js"
    "frontend/src/js/shotSelectors.js"
    "frontend/src/js/shotRenderLogic.js"
    "frontend/src/js/rival.js"
    "frontend/src/js/rivalUi.js"
    "frontend/src/js/rivalTables.js"
    "frontend/src/js/reportCanvas.js"
    "frontend/src/js/reportModel.js"
    "frontend/src/js/xlsxLoader.js"
    "frontend/src/js/ownShotWorkflow.js"
    "frontend/tests/ownShotWorkflow.test.js"

    "frontend/tests/sevenM.test.js"
    "frontend/tests/shotSelectors.test.js"

    "frontend/vendor/js/idb-umd.js"
    "frontend/vendor/js/xlsx.full.min.js"
    "frontend/vendor/js/jspdf.umd.min.js"

    "frontend/vendor/fonts/NotoSans-Regular.ttf"
    "frontend/vendor/fonts/NotoSans-Bold.ttf"
    "frontend/vendor/fonts/NotoSans-Italic.ttf"
    "frontend/vendor/fonts/NotoSans-BoldItalic.ttf"

    "frontend/src/js/courtHitTesting.js"
    "frontend/tests/courtHitTesting.test.js"

    "frontend/src/js/viewRefresh.js"
    "frontend/tests/viewRefresh.test.js"
)

echo "Checking required files..."

missing=0

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "MISSING: $file"
        missing=1
    fi
done

if [[ "$missing" -ne 0 ]]; then
    echo
    echo "ERROR: Required files are missing. Archive was not created."
    exit 1
fi

echo "Required files OK."
echo

# ------------------------------------------------------------
# 2.1 Service Worker app-shell consistency check
# ------------------------------------------------------------
# Runtime modules and vendor assets required by README/PWA mode
# must be referenced in frontend/sw.js, otherwise stale/offline
# PWA installs may miss newly added modules.
REQUIRED_SW_ASSETS=(
    "src/js/sevenM.js"
    "src/js/shotSelectors.js"
    "src/js/shotRenderLogic.js"

    "src/js/courtHitTesting.js"
    "src/js/ownShotWorkflow.js"

    "src/js/syncController.js"

    "vendor/js/idb-umd.js"
    "vendor/js/xlsx.full.min.js"
    "vendor/js/jspdf.umd.min.js"

    "vendor/fonts/NotoSans-Regular.ttf"
    "vendor/fonts/NotoSans-Bold.ttf"
    "vendor/fonts/NotoSans-Italic.ttf"
    "vendor/fonts/NotoSans-BoldItalic.ttf"
)

echo "Checking Service Worker app-shell references..."

sw_missing=0

for asset in "${REQUIRED_SW_ASSETS[@]}"; do
    if ! grep -Fq "$asset" "frontend/sw.js"; then
        echo "SW-MISSING: $asset"
        sw_missing=1
    fi
done

if [[ "$sw_missing" -ne 0 ]]; then
    echo
    echo "ERROR: Required runtime assets are not referenced in frontend/sw.js."
    echo "Add them to APP_SHELL and bump CACHE_VERSION before exporting."
    exit 1
fi

echo "Service Worker app-shell OK."
echo

# ------------------------------------------------------------
# 3. Secret / dangerous file guard
# ------------------------------------------------------------
# If any non-ignored file matches these patterns, fail hard.
# Better to stop than accidentally send secrets.
SECRET_PATTERNS=(
    ".env"
    ".env.*"
    "*.env"
    "*.pem"
    "*.key"
    "*.p12"
    "*.pfx"
    "id_rsa"
    "id_ed25519"
    "secrets.json"
    "*secret*.json"
    "*secrets*.json"
    "*service-account*.json"
)

echo "Scanning for accidentally includable secrets..."

secret_found=0

while IFS= read -r -d '' file; do
    base="$(basename "$file")"

    for pattern in "${SECRET_PATTERNS[@]}"; do
        case "$base" in
            $pattern)
                # Allow documentation/example env files.
                case "$base" in
                    ".env.example"|".env.sample")
                        ;;
                    *)
                        echo "SECRET-LIKE FILE FOUND: $file"
                        secret_found=1
                        ;;
                esac
                ;;
        esac
    done
done < <(git ls-files -z --cached --others --exclude-standard)

if [[ "$secret_found" -ne 0 ]]; then
    echo
    echo "ERROR: Secret-like files were found among includable files."
    echo "Fix .gitignore/.dockerignore or remove these files before exporting."
    exit 1
fi

echo "Secret scan OK."
echo

# ------------------------------------------------------------
# 4. Build clean file list
# ------------------------------------------------------------
# Includes:
#   - tracked files
#   - untracked files that are NOT ignored by .gitignore
#
# Excludes:
#   - node_modules
#   - dist/build/out/target
#   - coverage
#   - IDE files
#   - logs
#   - archives
#   - local temp/export artifacts
# ------------------------------------------------------------

echo "Collecting project files..."

FILE_COUNT=0

while IFS= read -r -d '' file; do
    # Normalize path style
    file="${file#./}"

    case "$file" in
        # Git / IDE / local folders
        .git/*|.idea/*|*/.idea/*|*.iml)

            continue
            ;;

        # Dependencies
        node_modules/*|*/node_modules/*)

            continue
            ;;

        # Build outputs
        dist/*|*/dist/*|build/*|*/build/*|out/*|*/out/*|target/*|*/target/*)

            continue
            ;;

        # Coverage / test artifacts
        coverage/*|*/coverage/*|test-results/*|*/test-results/*|playwright-report/*|*/playwright-report/*)

            continue
            ;;

        # Logs / temp / archives
        logs/*|*/logs/*|*.log|*.zip|*.tar|*.tar.gz|*.tgz)

            continue
            ;;

        # Export folder created by this script
        _export/*)

            continue
            ;;

        # OS junk
        .DS_Store|*/.DS_Store|Thumbs.db|*/Thumbs.db)

            continue
            ;;

        # Env files: example/sample are allowed, real env is not
        .env|.env.*|*/.env|*/.env.*)
            case "$file" in
                .env.example|.env.sample|*/.env.example|*/.env.sample)
                    ;;
                *)
                    continue
                    ;;
            esac
            ;;
    esac

    mkdir -p "$STAGE_DIR/$(dirname "$file")"
    cp -p "$file" "$STAGE_DIR/$file"
    FILE_COUNT=$((FILE_COUNT + 1))
done < <(git ls-files -z --cached --others --exclude-standard)

if [[ "$FILE_COUNT" -eq 0 ]]; then
    echo "ERROR: No files collected. Archive was not created."
    exit 1
fi

echo "Collected files: $FILE_COUNT"
echo

# ------------------------------------------------------------
# 5. Add small manifest for review
# ------------------------------------------------------------
{
    echo "Archive: ${PROJECT_NAME}_${STAMP}.zip"
    echo "Created: $(date)"
    echo "Project root: $PROJECT_ROOT"
    echo
    echo "Git status:"
    git status -sb || true
    echo
    echo "Included files:"
    find "$STAGE_DIR" -type f | sed "s|$STAGE_DIR/||" | sort
} > "$STAGE_DIR/ARCHIVE_MANIFEST.txt"

# ------------------------------------------------------------
# 6. Create ZIP
# ------------------------------------------------------------
echo "Creating ZIP..."
echo

rm -f "$ZIP_PATH"

# Prefer PowerShell Compress-Archive on Windows Git Bash.
# Important: do NOT redirect output to /dev/null.
# This keeps the nice PowerShell archive progress indicator visible.
if command -v powershell.exe >/dev/null 2>&1; then
    WIN_STAGE_DIR="$(cygpath -w "$STAGE_DIR")"
    WIN_ZIP_PATH="$(cygpath -w "$ZIP_PATH")"

    POWERSHELL_STAGE_DIR="$WIN_STAGE_DIR" \
    POWERSHELL_ZIP_PATH="$WIN_ZIP_PATH" \
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '
        $ErrorActionPreference = "Stop"

        $stageDir = $env:POWERSHELL_STAGE_DIR
        $zipPath = $env:POWERSHELL_ZIP_PATH

        Compress-Archive `
            -Path (Join-Path $stageDir "*") `
            -DestinationPath $zipPath `
            -Force

        function Write-ArchiveStatusLine {
            param(
                [string]$Text = ""
            )

            $width = 110

            try {
                $width = [Math]::Max(90, [Console]::WindowWidth - 1)
            } catch {
                $width = 110
            }

            $padLeft = 4
            $padRight = 4

            $line = (" " * $padLeft) + $Text + (" " * $padRight)

            if ($line.Length -gt $width) {
                $line = $line.Substring(0, $width)
            }

            $line = $line.PadRight($width)

            Write-Host $line `
                -ForegroundColor Yellow `
                -BackgroundColor DarkCyan
        }

            Write-Host ""
            Write-ArchiveStatusLine ""
            Write-ArchiveStatusLine "Compress-Archive"
            Write-ArchiveStatusLine "The archive file `"$zipPath`" creation completed."
            Write-ArchiveStatusLine ("[" + ("o" * 96) + "]")
            Write-ArchiveStatusLine ""
            Write-Host ""
    '
elif command -v zip >/dev/null 2>&1; then
    (
        cd "$STAGE_DIR"
        zip -r "$ZIP_PATH" .
    )
else
    echo "ERROR: Neither powershell.exe nor zip is available."
    echo "Install zip or run this script from Git Bash on Windows with PowerShell available."
    exit 1
fi

# ------------------------------------------------------------
# 7. Final verification
# ------------------------------------------------------------
if [[ ! -f "$ZIP_PATH" ]]; then
    echo "ERROR: ZIP was not created."
    exit 1
fi

ZIP_SIZE="$(du -h "$ZIP_PATH" | awk '{print $1}')"

echo
echo "DONE."
echo "Archive created:"
echo "$ZIP_PATH"
echo "Size: $ZIP_SIZE"
echo
echo "Quick check:"
echo "  - node_modules excluded"
echo "  - dist/build/coverage excluded"
echo "  - .env and secret-like files blocked"
echo "  - frontend runtime modules required and checked"
echo "  - Service Worker app-shell references checked"
echo "  - vendor idb/xlsx/jsPDF required and checked"
echo "  - Noto Sans PDF fonts required and checked"
echo