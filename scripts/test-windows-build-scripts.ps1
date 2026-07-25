<#
.SYNOPSIS
    Offline Windows PowerShell 5.1 preflight for retained build scripts.
.DESCRIPTION
    Parses PowerShell files, enforces UTF-8 BOM, and exercises the pure npm pin
    and MSVC path guards. It deliberately never downloads or installs anything.
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$HelperPath = Join-Path $PSScriptRoot "windows-build-helpers.ps1"
. $HelperPath

function Assert-True {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-Throws {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    $threw = $false
    try {
        & $Action
    }
    catch {
        $threw = $true
    }
    if (-not $threw) {
        throw $Message
    }
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    [IO.File]::WriteAllText($Path, $Content, (New-Object Text.UTF8Encoding($false)))
}

function New-NpmFixture {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PackageDir,

        [Parameter(Mandatory = $true)]
        [string]$Version
    )

    $manifests = @(
        [pscustomobject]@{ Path = "package.json"; Name = "npm"; Version = $Version },
        [pscustomobject]@{ Path = "node_modules\minizlib\package.json"; Name = "minizlib"; Version = "0.0.0-test" },
        [pscustomobject]@{ Path = "node_modules\minipass\package.json"; Name = "minipass"; Version = "0.0.0-test" },
        [pscustomobject]@{ Path = "node_modules\@npmcli\arborist\package.json"; Name = "@npmcli/arborist"; Version = "0.0.0-test" }
    )
    foreach ($manifest in $manifests) {
        $manifestPath = Join-Path $PackageDir $manifest.Path
        New-Item -ItemType Directory -Path (Split-Path -Parent $manifestPath) -Force | Out-Null
        $manifestJson = @{ name = $manifest.Name; version = $manifest.Version } | ConvertTo-Json -Compress
        Write-Utf8NoBom -Path $manifestPath -Content $manifestJson
    }

    $requiredFiles = @(
        "bin\npm-cli.js",
        "lib\cli\entry.js",
        "lib\npm.js",
        "node_modules\minizlib\dist\commonjs\index.js",
        "node_modules\minipass\dist\commonjs\index.js",
        "node_modules\@npmcli\arborist\lib\index.js"
    )
    foreach ($relativePath in $requiredFiles) {
        $fixturePath = Join-Path $PackageDir $relativePath
        New-Item -ItemType Directory -Path (Split-Path -Parent $fixturePath) -Force | Out-Null
        Write-Utf8NoBom -Path $fixturePath -Content "// inert test fixture"
    }
}

Write-Host "[windows-preflight] PowerShell $($PSVersionTable.PSVersion)"
if ($PSVersionTable.PSVersion.Major -ne 5) {
    Write-Host "[windows-preflight] 警告: CI 必须用 Windows PowerShell 5.1 运行此脚本" -ForegroundColor Yellow
}

$retainedScripts = @(
    Get-ChildItem -LiteralPath $RepoRoot -File -Filter "*.ps1"
    Get-ChildItem -LiteralPath $PSScriptRoot -File -Filter "*.ps1"
) | Sort-Object FullName -Unique

foreach ($scriptFile in $retainedScripts) {
    $bytes = [IO.File]::ReadAllBytes($scriptFile.FullName)
    Assert-True `
        -Condition ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) `
        -Message "PowerShell 5.1 要求含非 ASCII 文本的 retained PS1 使用 UTF-8 BOM: $($scriptFile.FullName)"

    $tokens = $null
    $parseErrors = $null
    $null = [Management.Automation.Language.Parser]::ParseFile(
        $scriptFile.FullName,
        [ref]$tokens,
        [ref]$parseErrors
    )
    if ($parseErrors.Count -gt 0) {
        $details = ($parseErrors | ForEach-Object { "$($_.Extent.StartLineNumber): $($_.Message)" }) -join "; "
        throw "PowerShell parse failed for $($scriptFile.FullName): $details"
    }
}
Write-Host "[windows-preflight] $($retainedScripts.Count) 个 retained PS1 均可解析且带 UTF-8 BOM" -ForegroundColor Green

$filesWithNpmPolicy = @(
    (Join-Path $RepoRoot "build_windows.ps1"),
    (Join-Path $RepoRoot "setup_windows.ps1"),
    $HelperPath
)
foreach ($policyFile in $filesWithNpmPolicy) {
    $source = Get-Content -LiteralPath $policyFile -Raw -Encoding UTF8
    Assert-True `
        -Condition ($source -notmatch 'npm/latest|npm@latest') `
        -Message "Windows npm provisioning must never use a floating latest version: $policyFile"
    Assert-True `
        -Condition ($source -notmatch 'npm-cli\.js[^\r\n]*--version') `
        -Message "Windows npm provisioning must inspect package.json instead of executing the old npm: $policyFile"
}
$pinnedNpmVersion = Get-PinnedNpmVersion -ProjectDir $RepoRoot
Assert-True `
    -Condition ($pinnedNpmVersion -match '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') `
    -Message "repository packageManager must contain an exact npm version"

$buildSource = Get-Content -LiteralPath (Join-Path $RepoRoot "build_windows.ps1") -Raw -Encoding UTF8
$setupSource = Get-Content -LiteralPath (Join-Path $RepoRoot "setup_windows.ps1") -Raw -Encoding UTF8
$devSource = Get-Content -LiteralPath (Join-Path $RepoRoot "build_dev_win.ps1") -Raw -Encoding UTF8
$helperSource = Get-Content -LiteralPath $HelperPath -Raw -Encoding UTF8
Assert-True ($buildSource.Contains('Ensure-BundledNpm')) "release build must use shared npm provisioning"
Assert-True ($setupSource.Contains('Ensure-BundledNpm')) "setup must use shared npm provisioning"
Assert-True ($buildSource.Contains('$installedNodeVersion -eq "v$NodeVersion"')) "release build must reject stale bundled Node.js"
Assert-True ($buildSource.Contains('Import-MSVCEnvironment')) "release build must import verified MSVC environment"
Assert-True ($devSource.Contains('Import-MSVCEnvironment')) "dev build must import verified MSVC environment"
Assert-True ($helperSource.Contains('Assert-MSVCLinkLibraries -LibraryPath $env:LIB')) "MSVC import must verify effective linker libraries"
Assert-True ($helperSource.Contains('if ($swapCommitted -or -not $backupCreated)')) "npm cleanup must preserve a backup after rollback failure"

$tempRoot = Join-Path $env:TEMP "blexagent-windows-helper-test-$PID"
try {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    $projectDir = Join-Path $tempRoot "project"
    $nodeDir = Join-Path $tempRoot "nodejs"
    $npmDir = Join-Path $nodeDir "node_modules\npm"
    New-Item -ItemType Directory -Path $projectDir -Force | Out-Null

    $projectManifest = @{ packageManager = "npm@$pinnedNpmVersion" } | ConvertTo-Json -Compress
    Write-Utf8NoBom -Path (Join-Path $projectDir "package.json") -Content $projectManifest
    New-NpmFixture -PackageDir $npmDir -Version $pinnedNpmVersion
    Assert-True `
        -Condition ((Get-PinnedNpmVersion -ProjectDir $projectDir) -eq $pinnedNpmVersion) `
        -Message "exact npm packageManager pin was not parsed"
    Assert-True `
        -Condition (Test-BundledNpmMatchesPin -ProjectDir $projectDir -NodeDir $nodeDir) `
        -Message "matching bundled npm manifest was not accepted"
    $npmResult = Ensure-BundledNpm -ProjectDir $projectDir -NodeDir $nodeDir
    Assert-True `
        -Condition ($npmResult.Version -eq $pinnedNpmVersion -and -not $npmResult.Changed) `
        -Message "matching npm must be a no-download no-op"

    Remove-Item -LiteralPath (Join-Path $npmDir "bin\npm-cli.js") -Force
    Assert-True `
        -Condition (-not (Test-BundledNpmMatchesPin -ProjectDir $projectDir -NodeDir $nodeDir)) `
        -Message "a matching version manifest must not hide a truncated npm package"
    Write-Utf8NoBom `
        -Path (Join-Path $npmDir "bin\npm-cli.js") `
        -Content '// restored inert test fixture'

    $minizlibEntry = Join-Path $npmDir "node_modules\minizlib\dist\commonjs\index.js"
    Remove-Item -LiteralPath $minizlibEntry -Force
    Assert-True (-not (Test-BundledNpmMatchesPin -ProjectDir $projectDir -NodeDir $nodeDir)) "a matching version manifest must not hide truncated deep npm dependencies"
    Write-Utf8NoBom -Path $minizlibEntry -Content '// restored inert test fixture'

    $minipassManifest = Join-Path $npmDir "node_modules\minipass\package.json"
    Write-Utf8NoBom -Path $minipassManifest -Content '{"name":"unexpected-package","version":"0.0.0-test"}'
    Assert-True (-not (Test-BundledNpmMatchesPin -ProjectDir $projectDir -NodeDir $nodeDir)) "a matching npm version must not hide a dependency identity mismatch"
    Write-Utf8NoBom -Path $minipassManifest -Content '{"name":"minipass","version":"0.0.0-test"}'

    Write-Utf8NoBom `
        -Path (Join-Path $projectDir "package.json") `
        -Content '{"packageManager":"npm@latest"}'
    Assert-Throws `
        -Action { Get-PinnedNpmVersion -ProjectDir $projectDir } `
        -Message "floating npm packageManager value must be rejected"

    $fakeVs = Join-Path $tempRoot "Microsoft Visual Studio\2022\BuildTools"
    $fakeCl = Join-Path $fakeVs "VC\Tools\MSVC\14.0\bin\Hostx64\x64\cl.exe"
    $fakeLink = Join-Path $fakeVs "VC\Tools\MSVC\14.0\bin\Hostx64\x64\link.exe"
    $fakeGitLink = Join-Path $tempRoot "Git\usr\bin\link.exe"
    $validated = Assert-MSVCCommandPaths -InstallationPath $fakeVs -ClPath $fakeCl -LinkPath $fakeLink
    Assert-True ($validated.LinkPath -eq [IO.Path]::GetFullPath($fakeLink)) "Visual Studio linker path should be accepted"
    Assert-Throws `
        -Action { Assert-MSVCCommandPaths -InstallationPath $fakeVs -ClPath $fakeCl -LinkPath $fakeGitLink } `
        -Message "Git link.exe must never satisfy the MSVC linker check"

    $fakeMsvcLib = Join-Path $tempRoot "lib\msvc"
    $fakeUcrtLib = Join-Path $tempRoot "lib\ucrt"
    $fakeUmLib = Join-Path $tempRoot "lib\um"
    foreach ($libraryDir in @($fakeMsvcLib, $fakeUcrtLib, $fakeUmLib)) {
        New-Item -ItemType Directory -Path $libraryDir -Force | Out-Null
    }
    Write-Utf8NoBom -Path (Join-Path $fakeMsvcLib "libcmt.lib") -Content "fixture"
    Write-Utf8NoBom -Path (Join-Path $fakeUcrtLib "ucrt.lib") -Content "fixture"
    $fakeKernel32 = Join-Path $fakeUmLib "kernel32.lib"
    Write-Utf8NoBom -Path $fakeKernel32 -Content "fixture"
    $fakeLibraryPath = @($fakeMsvcLib, $fakeUcrtLib, $fakeUmLib) -join ';'
    $validatedLibraries = Assert-MSVCLinkLibraries -LibraryPath $fakeLibraryPath
    Assert-True ($validatedLibraries.Kernel32Path -eq [IO.Path]::GetFullPath($fakeKernel32)) "Windows SDK kernel32.lib should be resolved from LIB"
    Remove-Item -LiteralPath $fakeKernel32 -Force
    Assert-Throws { Assert-MSVCLinkLibraries -LibraryPath $fakeLibraryPath } "missing Windows SDK kernel32.lib must be rejected"
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[windows-preflight] npm 完整性与 MSVC linker/SDK guards 通过（offline）" -ForegroundColor Green
