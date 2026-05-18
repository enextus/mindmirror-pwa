#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# make-project-zip.sh
# Creates a clean Mind Mirror PWA context archive for KI review.
#
# Intended for Git Bash on Windows, but also works on macOS/Linux
# when `zip` is available.
#
# Usage:
#   ./make-project-zip.sh
#
# Optional environment flags:
#   STRICT_SW_CHECK=1     Fail if runtime app-shell entries are missing in frontend/sw.js.
#   INCLUDE_VENDOR_JS=1   Include frontend/vendor/js files. Default: excluded from ChatGPT context.
#
# Output:
#   ./_export/mindmirror-pwa_context_YYYY-MM-DD_HH-MM-SS.zip
#
# Notes:
#   - This is a ChatGPT/context archive, not a deployment archive.
#   - node_modules, coverage, build artifacts, archives and secrets are excluded.
#   - font binaries (*.ttf, *.otf, *.woff, *.woff2) are always excluded.
# ============================================================

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_NAME="mindmirror-pwa"
ARCHIVE_KIND="context"
STAMP="$(date +"%Y-%m-%d_%H-%M-%S")"
STRICT_SW_CHECK="${STRICT_SW_CHECK:-0}"
INCLUDE_VENDOR_JS="${INCLUDE_VENDOR_JS:-0}"

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
ZIP_PATH="$EXPORT_DIR/${PROJECT_NAME}_${ARCHIVE_KIND}_${STAMP}.zip"

mkdir -p "$EXPORT_DIR"
mkdir -p "$STAGE_DIR"

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Project root:     $PROJECT_ROOT"
echo "Export dir:       $EXPORT_DIR"
echo "ZIP path:         $ZIP_PATH"
echo "Strict SW check:  $STRICT_SW_CHECK"
echo "Include vendor JS:$INCLUDE_VENDOR_JS"
echo

# ------------------------------------------------------------
# 2. Required project structure check
# ------------------------------------------------------------
# Keep this list focused on first-class project sources/configs.
# Third-party binaries are checked separately or intentionally excluded.
REQUIRED_FILES=(
    ".gitignore"
    "make-project-zip.sh"

    "frontend/README.md"
    "frontend/package.json"
    "frontend/package-lock.json"
    "frontend/index.html"
    "frontend/manifest.json"
    "frontend/offline.html"
    "frontend/sw.js"
    "frontend/vitest.config.js"
    "frontend/tsconfig.json"
    "frontend/eslint.config.js"

    "frontend/src/css/app.css"

    "frontend/src/js/app.js"
    "frontend/src/js/appVersion.js"

    "frontend/src/js/core/scoringEngine.js"
    "frontend/src/js/core/profileBuilder.js"
    "frontend/src/js/core/profileComparator.js"
    "frontend/src/js/core/lifeSimulationEngine.js"
    "frontend/src/js/core/difficulty.js"
    "frontend/src/js/core/labels.js"
    "frontend/src/js/core/geometry.js"

    "frontend/src/js/data/realms.js"
    "frontend/src/js/data/scoreTables.js"
    "frontend/src/js/data/scales.js"
    "frontend/src/js/data/sampleEvents.js"
    "frontend/src/js/data/presets.js"

    "frontend/src/js/db/db.js"
    "frontend/src/js/db/repositories.js"
    "frontend/src/js/db/migrations.js"

    "frontend/src/js/ui/dom.js"
    "frontend/src/js/ui/router.js"
    "frontend/src/js/ui/screens.js"
    "frontend/src/js/ui/profileScreen.js"
    "frontend/src/js/ui/ratingScreen.js"
    "frontend/src/js/ui/comparisonScreen.js"
    "frontend/src/js/ui/simulationScreen.js"
    "frontend/src/js/ui/exportScreen.js"
    "frontend/src/js/ui/subjectForm.js"
    "frontend/src/js/ui/toast.js"
    "frontend/src/js/ui/retroTheme.js"
    "frontend/src/js/ui/keyboard.js"
    "frontend/src/js/ui/retroTextScreen.js"
    "frontend/src/js/ui/retroMenuScreen.js"

    "frontend/src/js/canvas/mindMapGeometry.js"
    "frontend/src/js/canvas/mindMapRenderer.js"
    "frontend/src/js/canvas/labelLayout.js"
    "frontend/src/js/canvas/markerRenderer.js"

    "frontend/src/js/export/exportJson.js"
    "frontend/src/js/export/exportXlsx.js"
    "frontend/src/js/export/exportPdf.js"
    "frontend/src/js/export/pdfFonts.js"

    "frontend/src/js/pwa/pwa.js"
    "frontend/src/js/pwa/swRegistration.js"

    "frontend/src/js/types/mindmirror.d.ts"
    "frontend/src/js/types/idb-global.d.ts"
    "frontend/src/js/types/jspdf-global.d.ts"
    "frontend/src/js/types/xlsx-global.d.ts"

    "frontend/tests/scoringEngine.test.js"
    "frontend/tests/profileBuilder.test.js"
    "frontend/tests/profileComparator.test.js"
    "frontend/tests/lifeSimulationEngine.test.js"
    "frontend/tests/mindMapGeometry.test.js"
    "frontend/tests/mindMapRenderer.test.js"
    "frontend/tests/profileScreen.test.js"
    "frontend/tests/db.test.js"
    "frontend/tests/exportPdf.test.js"
    "frontend/tests/modules.test.js"
)

echo "Checking required project files..."

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
# 2.1 Optional vendor presence check
# ------------------------------------------------------------
# These paths are useful locally, but vendor bundles and font binaries are
# excluded from the ChatGPT context archive by default.
OPTIONAL_VENDOR_PATHS=(
    "frontend/vendor/js/idb-umd.js"
    "frontend/vendor/js/xlsx.full.min.js"
    "frontend/vendor/js/jspdf.umd.min.js"
    "frontend/vendor/fonts/README.md"
)

echo "Checking optional vendor placeholders/bundles..."
for file in "${OPTIONAL_VENDOR_PATHS[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "VENDOR-WARNING: $file not found"
    fi
done

echo "Vendor check completed."
echo

# ------------------------------------------------------------
# 2.2 Service Worker app-shell consistency check
# ------------------------------------------------------------
# Keep this non-blocking by default because early development can add modules
# before the final app-shell is stabilized.
REQUIRED_SW_ASSETS=(
    "src/js/appVersion.js"
    "src/js/app.js"
    "src/css/app.css"

    "src/js/core/scoringEngine.js"
    "src/js/core/profileBuilder.js"
    "src/js/core/profileComparator.js"

    "src/js/data/realms.js"
    "src/js/data/scoreTables.js"
    "src/js/data/scales.js"

    "src/js/canvas/mindMapGeometry.js"
    "src/js/canvas/mindMapRenderer.js"
    "src/js/canvas/labelLayout.js"
    "src/js/canvas/markerRenderer.js"

    "src/js/ui/profileScreen.js"
    "src/js/ui/retroTheme.js"
    "src/js/ui/keyboard.js"
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
    if [[ "$STRICT_SW_CHECK" == "1" ]]; then
        echo "ERROR: Required runtime assets are not referenced in frontend/sw.js."
        echo "Add them to APP_SHELL and bump MIND_MIRROR_APP_VERSION before exporting."
        exit 1
    else
        echo "WARNING: Service Worker app-shell is not complete yet."
        echo "Set STRICT_SW_CHECK=1 to make this blocking."
    fi
else
    echo "Service Worker app-shell OK."
fi
echo

# ------------------------------------------------------------
# 3. Secret / dangerous file guard
# ------------------------------------------------------------
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
    "*.sqlite"
    "*.db"
)

echo "Scanning for accidentally includable secrets..."

secret_found=0
while IFS= read -r -d '' file; do
    base="$(basename "$file")"

    for pattern in "${SECRET_PATTERNS[@]}"; do
        case "$base" in
            $pattern)
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
    echo "Fix .gitignore or remove these files before exporting."
    exit 1
fi

echo "Secret scan OK."
echo

# ------------------------------------------------------------
# 4. Build clean file list
# ------------------------------------------------------------
echo "Collecting project files..."

FILE_COUNT=0
EXCLUDED_VENDOR_COUNT=0
EXCLUDED_FONT_COUNT=0

while IFS= read -r -d '' file; do
    file="${file#./}"

    case "$file" in
        # Git / IDE / local folders
        .git/*|.idea/*|*/.idea/*|.vscode/*|*/.vscode/*|*.iml)
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

        # Logs / temp / archives / exported packages
        logs/*|*/logs/*|*.log|*.zip|*.rar|*.7z|*.tar|*.tar.gz|*.tgz|_export/*|*/_export/*)
            continue
            ;;

        # Media / binary research references: keep them outside ChatGPT context zips
        *.mp4|*.mov|*.avi|*.mkv|*.webm|*.mp3|*.wav|*.m4a|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.pdf|*.exe|*.com|*.dat|*.bin|*.img)
            continue
            ;;

        # Font binaries are intentionally never included in ChatGPT context archives
        *.ttf|*.otf|*.woff|*.woff2)
            EXCLUDED_FONT_COUNT=$((EXCLUDED_FONT_COUNT + 1))
            continue
            ;;

        # Vendor JS is optional and excluded by default because minified bundles are low-context/high-noise
        frontend/vendor/js/*)
            if [[ "$INCLUDE_VENDOR_JS" != "1" ]]; then
                EXCLUDED_VENDOR_COUNT=$((EXCLUDED_VENDOR_COUNT + 1))
                continue
            fi
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

echo "Collected files:        $FILE_COUNT"
echo "Excluded vendor JS:     $EXCLUDED_VENDOR_COUNT"
echo "Excluded font binaries: $EXCLUDED_FONT_COUNT"
echo

# ------------------------------------------------------------
# 5. Add manifest for review
# ------------------------------------------------------------
{
    echo "Archive: ${PROJECT_NAME}_${ARCHIVE_KIND}_${STAMP}.zip"
    echo "Created: $(date)"
    echo "Project root: $PROJECT_ROOT"
    echo "Archive kind: $ARCHIVE_KIND"
    echo "Strict SW check: $STRICT_SW_CHECK"
    echo "Include vendor JS: $INCLUDE_VENDOR_JS"
    echo
    echo "Git status:"
    git status -sb || true
    echo
    echo "Git HEAD:"
    git rev-parse --short HEAD 2>/dev/null || true
    echo
    echo "Notes:"
    echo "- This archive is intended for ChatGPT/code review context."
    echo "- node_modules, coverage, build outputs and local archives are excluded."
    echo "- Font binaries are intentionally excluded. Keep local fonts in frontend/vendor/fonts."
    echo "- Vendor JS is excluded unless INCLUDE_VENDOR_JS=1 is set."
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

if command -v powershell.exe >/dev/null 2>&1 && command -v cygpath >/dev/null 2>&1; then
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
            param([string]$Text = "")

            $width = 110

            try {
                $width = [Math]::Max(90, [Console]::WindowWidth - 1)
            } catch {
                $width = 110
            }

            $line = (" " * 4) + $Text + (" " * 4)

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
echo "  - local archives and binary research references excluded"
echo "  - font binaries excluded"
echo "  - vendor JS excluded by default; set INCLUDE_VENDOR_JS=1 if needed"
echo "  - manifest added as ARCHIVE_MANIFEST.txt"
