# rename_myagents_to_blexagent.ps1
# Batch rename MyAgents -> BlexAgent across the entire codebase
# Run from project root: powershell -ExecutionPolicy Bypass -File scripts/rename_myagents_to_blexagent.ps1

$ErrorActionPreference = "Stop"

$projectRoot = "d:\workP\BlexAgents"

# File extensions to process
$extensions = @("*.ts", "*.tsx", "*.rs", "*.json", "*.toml", "*.md", "*.nsi", "*.nsh", "*.strings", "*.plist", "*.html", "*.css", "*.sh", "*.ps1", "*.cjs", "*.mjs", "*.js")

# Directories to exclude
$excludeDirs = @("node_modules", ".git", "target", "dist", "src-tauri/target", "scripts")

# Replacement pairs - ORDER MATTERS: longest patterns first to avoid substring conflicts
$replacements = @(
    # Domain-specific (longest first)
    @{ Old = "com.myagents.app"; New = "com.blexagents.app" },
    @{ Old = "download.myagents.io"; New = "download.blexagent.com" },
    @{ Old = "myagents.localhost"; New = "blexagent.localhost" },
    @{ Old = "myagents.io@gmail.com"; New = "team@blexagent.com" },
    @{ Old = "myagents.io"; New = "blexagent.com" },

    # Compound identifiers
    @{ Old = "myagents_helper"; New = "blexagent_helper" },
    @{ Old = "myagents-cli"; New = "blexagent-cli" },

    # GitHub repo reference
    @{ Old = "hAcKlyc/MyAgents"; New = "blexagent/blexagent" },

    # Author
    @{ Old = "MyAgents Team"; New = "BlexAgent Team" },

    # Home path patterns
    @{ Old = "~/.myagents"; New = "~/.blexagent" },
    @{ Old = "`$HOME/.myagents"; New = "`$HOME/.blexagent" },
    @{ Old = "`$home/.myagents"; New = "`$home/.blexagent" },
    @{ Old = "{HOME}/.myagents"; New = "{HOME}/.blexagent" },

    # Case-sensitive PascalCase (before lowercase)
    @{ Old = "MyAgents"; New = "BlexAgent" },

    # Uppercase
    @{ Old = "MYAGENTS"; New = "BLEXAGENT" },

    # Lowercase (last - shortest, most broad)
    @{ Old = "myagents"; New = "blexagent" }
)

function Process-File {
    param([string]$FilePath)

    # Skip binary files
    $binaryExtensions = @(".wasm", ".node", ".exe", ".dll", ".so", ".dylib", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot")
    $ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
    if ($binaryExtensions -contains $ext) { return }

    # Skip this script itself
    if ($FilePath -like "*rename_myagents_to_blexagent*") { return }

    try {
        $content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
        $originalContent = $content

        foreach ($rep in $replacements) {
            $content = $content.Replace($rep.Old, $rep.New)
        }

        if ($content -ne $originalContent) {
            [System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::UTF8)
            Write-Host "  Updated: $FilePath" -ForegroundColor Green
            return $true
        }
        return $false
    } catch {
        Write-Host "  ERROR processing ${FilePath}: $_" -ForegroundColor Red
        return $false
    }
}

Write-Host "=== MyAgents -> BlexAgent Batch Rename ===" -ForegroundColor Cyan
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan
Write-Host ""

$totalFiles = 0
$updatedFiles = 0

foreach ($ext in $extensions) {
    $files = Get-ChildItem -Path $projectRoot -Filter $ext -Recurse -File |
        Where-Object {
            $path = $_.FullName
            $shouldExclude = $false
            foreach ($dir in $excludeDirs) {
                if ($path -like "*\$dir\*" -or $path -like "*\$dir") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }

    foreach ($file in $files) {
        $totalFiles++
        if (Process-File -FilePath $file.FullName) {
            $updatedFiles++
        }
    }
}

Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Cyan
Write-Host "Files scanned: $totalFiles" -ForegroundColor Cyan
Write-Host "Files updated: $updatedFiles" -ForegroundColor Cyan
