<#
.SYNOPSIS
    Shared Windows build helpers for the bundled npm runtime and MSVC toolchain.
.DESCRIPTION
    This file is intentionally side-effect free when dot-sourced. Callers opt in
    to npm staging or MSVC environment import through the functions below.
#>

function Get-PinnedNpmVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir
    )

    $packageJsonPath = Join-Path $ProjectDir "package.json"
    if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
        throw "package.json 不存在: $packageJsonPath"
    }

    $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $packageManager = [string]$packageJson.packageManager
    if ($packageManager -notmatch '^npm@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$') {
        throw "package.json packageManager 必须固定为精确 npm 版本（例如 npm@11.13.0），当前值: '$packageManager'"
    }

    return $Matches[1]
}

function Get-BundledNpmVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$NodeDir
    )

    $npmPackageJson = Join-Path $NodeDir "node_modules\npm\package.json"
    if (-not (Test-Path -LiteralPath $npmPackageJson -PathType Leaf)) {
        return $null
    }

    try {
        $manifest = Get-Content -LiteralPath $npmPackageJson -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([string]$manifest.name -ne "npm") {
            return $null
        }
        return [string]$manifest.version
    }
    catch {
        return $null
    }
}

function Test-BundledNpmMatchesPin {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir,

        [Parameter(Mandatory = $true)]
        [string]$NodeDir
    )

    $expectedVersion = Get-PinnedNpmVersion -ProjectDir $ProjectDir
    $installedVersion = Get-BundledNpmVersion -NodeDir $NodeDir
    if ($installedVersion -ne $expectedVersion) {
        return $false
    }

    try {
        Assert-NpmPackageManifest `
            -PackageDir (Join-Path $NodeDir "node_modules\npm") `
            -ExpectedVersion $expectedVersion
        return $true
    }
    catch {
        return $false
    }
}

function Get-Sha512Base64 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $hex = (Get-FileHash -LiteralPath $Path -Algorithm SHA512).Hash
    $bytes = New-Object byte[] ($hex.Length / 2)
    for ($index = 0; $index -lt $bytes.Length; $index++) {
        $bytes[$index] = [Convert]::ToByte($hex.Substring($index * 2, 2), 16)
    }
    return [Convert]::ToBase64String($bytes)
}

function Assert-NpmPackageManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PackageDir,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedVersion
    )

    $manifestPath = Join-Path $PackageDir "package.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "npm 包缺少 package.json: $manifestPath"
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]$manifest.name -ne "npm" -or [string]$manifest.version -ne $ExpectedVersion) {
        throw "npm 包身份校验失败（expected npm@$ExpectedVersion, got $($manifest.name)@$($manifest.version)）"
    }

    # Cover npm's main CLI and the deep dependency paths that were historically
    # truncated by Copy-Item on Windows MAX_PATH.
    $requiredFiles = @(
        "bin\npm-cli.js",
        "lib\cli\entry.js",
        "lib\npm.js",
        "node_modules\minizlib\dist\commonjs\index.js",
        "node_modules\minipass\dist\commonjs\index.js",
        "node_modules\@npmcli\arborist\lib\index.js"
    )
    foreach ($relativePath in $requiredFiles) {
        $requiredPath = Join-Path $PackageDir $relativePath
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "npm 包缺少必需文件 $($relativePath): $requiredPath"
        }
    }

    $dependencyManifests = @(
        [pscustomobject]@{ Path = "node_modules\minizlib\package.json"; Name = "minizlib" },
        [pscustomobject]@{ Path = "node_modules\minipass\package.json"; Name = "minipass" },
        [pscustomobject]@{ Path = "node_modules\@npmcli\arborist\package.json"; Name = "@npmcli/arborist" }
    )
    foreach ($dependency in $dependencyManifests) {
        $dependencyManifestPath = Join-Path $PackageDir $dependency.Path
        if (-not (Test-Path -LiteralPath $dependencyManifestPath -PathType Leaf)) {
            throw "npm 包缺少依赖清单 $($dependency.Path): $dependencyManifestPath"
        }
        $dependencyManifest = Get-Content -LiteralPath $dependencyManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([string]$dependencyManifest.name -ne [string]$dependency.Name) {
            throw "npm 依赖身份校验失败（expected $($dependency.Name), got $($dependencyManifest.name)）: $dependencyManifestPath"
        }
    }
}

function Ensure-BundledNpm {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir,

        [Parameter(Mandatory = $true)]
        [string]$NodeDir
    )

    $expectedVersion = Get-PinnedNpmVersion -ProjectDir $ProjectDir
    $installedVersion = Get-BundledNpmVersion -NodeDir $NodeDir
    if (Test-BundledNpmMatchesPin -ProjectDir $ProjectDir -NodeDir $NodeDir) {
        Write-Host "  npm v$expectedVersion（package.json pin，already present）" -ForegroundColor Green
        return [pscustomobject]@{ Version = $expectedVersion; Changed = $false }
    }

    # Never execute the npm being replaced: incompatible npm versions print a
    # warning before doing any useful work, and historically the broken npm was
    # unable to upgrade itself. package.json is the authoritative version probe.
    $registryBase = "https://registry.npmjs.org"
    $metadataUrl = "$registryBase/npm/$expectedVersion"
    $canonicalTarballUrl = "$registryBase/npm/-/npm-$expectedVersion.tgz"
    $tempRoot = Join-Path $env:TEMP "blexagent-npm-$expectedVersion-$([Guid]::NewGuid().ToString('N'))"
    $tarballPath = Join-Path $tempRoot "npm-$expectedVersion.tgz.download"
    $extractDir = Join-Path $tempRoot "extract"
    $npmParentDir = Join-Path $NodeDir "node_modules"
    $npmDir = Join-Path $npmParentDir "npm"
    $stagingDir = Join-Path $npmParentDir "npm.__staging.$([Guid]::NewGuid().ToString('N'))"
    $backupDir = Join-Path $npmParentDir "npm.__backup.$([Guid]::NewGuid().ToString('N'))"
    $backupCreated = $false
    $swapCommitted = $false

    Write-Host "  准备固定 npm v$expectedVersion（当前: $(if ($installedVersion) { 'v' + $installedVersion } else { 'missing' })）..." -ForegroundColor Cyan

    try {
        New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
        New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
        New-Item -ItemType Directory -Path $npmParentDir -Force | Out-Null

        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $metadata = Invoke-RestMethod -Uri $metadataUrl -UseBasicParsing -TimeoutSec 60
        if ([string]$metadata.name -ne "npm" -or [string]$metadata.version -ne $expectedVersion) {
            throw "npm registry metadata 身份不匹配"
        }
        if ([string]$metadata.dist.tarball -ne $canonicalTarballUrl) {
            throw "npm registry 返回了非预期 tarball URL: $($metadata.dist.tarball)"
        }
        $integrity = [string]$metadata.dist.integrity
        if ($integrity -notmatch '^sha512-(.+)$') {
            throw "npm registry metadata 缺少 SHA-512 integrity"
        }
        $expectedSha512 = $Matches[1]

        Invoke-WebRequest -Uri $canonicalTarballUrl -OutFile $tarballPath -UseBasicParsing -TimeoutSec 300
        $actualSha512 = Get-Sha512Base64 -Path $tarballPath
        if (-not [string]::Equals($actualSha512, $expectedSha512, [StringComparison]::Ordinal)) {
            throw "npm tarball SHA-512 校验失败"
        }

        $tarCommand = Get-Command tar.exe -CommandType Application -ErrorAction SilentlyContinue
        if (-not $tarCommand) {
            throw "未找到 Windows tar.exe，无法解压 npm tarball"
        }
        & $tarCommand.Source -xzf $tarballPath -C $extractDir
        if ($LASTEXITCODE -ne 0) {
            throw "tar.exe 解压 npm 失败（exit $LASTEXITCODE）"
        }

        $extractedPackage = Join-Path $extractDir "package"
        Assert-NpmPackageManifest -PackageDir $extractedPackage -ExpectedVersion $expectedVersion

        # robocopy preserves npm's deep dependency paths. Copy into a sibling
        # staging directory first, then swap names on the target volume so a
        # partial download/copy can never destroy the previously usable npm.
        & robocopy.exe $extractedPackage $stagingDir /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) {
            throw "robocopy npm staging 失败（exit $LASTEXITCODE）"
        }
        Assert-NpmPackageManifest -PackageDir $stagingDir -ExpectedVersion $expectedVersion

        if (Test-Path -LiteralPath $npmDir) {
            Move-Item -LiteralPath $npmDir -Destination $backupDir
            $backupCreated = $true
        }
        Move-Item -LiteralPath $stagingDir -Destination $npmDir
        Assert-NpmPackageManifest -PackageDir $npmDir -ExpectedVersion $expectedVersion
        $swapCommitted = $true

        if ($backupCreated) {
            # The new package is verified. Backup cleanup is best-effort and
            # must not turn a committed installation into a rollback.
            Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction SilentlyContinue
            $backupCreated = $false
        }

        Write-Host "  npm 已固定为 v$expectedVersion（SHA-512 + package identity verified）" -ForegroundColor Green
        return [pscustomobject]@{ Version = $expectedVersion; Changed = $true }
    }
    catch {
        $installError = $_
        if (-not $swapCommitted -and $backupCreated) {
            if (-not (Test-Path -LiteralPath $backupDir -PathType Container)) {
                throw "npm 安装失败且旧版本备份意外缺失。安装错误: $installError；expected backup: $backupDir"
            }
            try {
                if (Test-Path -LiteralPath $npmDir) {
                    Remove-Item -LiteralPath $npmDir -Recurse -Force -ErrorAction Stop
                }
                Move-Item -LiteralPath $backupDir -Destination $npmDir -ErrorAction Stop
                $backupCreated = $false
            }
            catch {
                $rollbackError = $_
                throw "npm 安装失败且回滚失败。安装错误: $installError；回滚错误: $rollbackError；旧版本备份已保留在: $backupDir"
            }
        }
        throw $installError
    }
    finally {
        Remove-Item -LiteralPath $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
        # A true backupCreated flag means rollback failed. Preserve the only
        # known-good npm instead of silently deleting it during cleanup.
        if ($swapCommitted -or -not $backupCreated) {
            Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-VSWherePath {
    [CmdletBinding()]
    param()

    $programFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
    if ([string]::IsNullOrWhiteSpace($programFilesX86)) {
        return $null
    }
    $vsWherePath = Join-Path $programFilesX86 "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path -LiteralPath $vsWherePath -PathType Leaf) {
        return $vsWherePath
    }
    return $null
}

function Assert-MSVCCommandPaths {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallationPath,

        [Parameter(Mandatory = $true)]
        [string]$ClPath,

        [Parameter(Mandatory = $true)]
        [string]$LinkPath
    )

    $installationRoot = [IO.Path]::GetFullPath($InstallationPath).TrimEnd('\') + '\'
    $resolvedCl = [IO.Path]::GetFullPath($ClPath)
    $resolvedLink = [IO.Path]::GetFullPath($LinkPath)

    if (-not $resolvedCl.StartsWith($installationRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "cl.exe 不是来自选中的 Visual Studio: $resolvedCl"
    }
    if (-not $resolvedLink.StartsWith($installationRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "link.exe 不是来自选中的 Visual Studio（可能误命中 Git link.exe）: $resolvedLink"
    }

    return [pscustomobject]@{
        InstallationPath = $installationRoot.TrimEnd('\')
        ClPath = $resolvedCl
        LinkPath = $resolvedLink
    }
}

function Assert-MSVCLinkLibraries {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$LibraryPath
    )

    if ([string]::IsNullOrWhiteSpace($LibraryPath)) {
        throw "vcvarsall 已执行，但 LIB 环境变量为空"
    }

    $libraryDirectories = @(
        $LibraryPath -split ';' |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
    $requiredLibraries = @(
        [pscustomobject]@{ Name = "kernel32.lib"; Purpose = "Windows SDK UM"; Property = "Kernel32Path" },
        [pscustomobject]@{ Name = "ucrt.lib"; Purpose = "Windows SDK UCRT"; Property = "UcrtPath" },
        [pscustomobject]@{ Name = "libcmt.lib"; Purpose = "MSVC CRT"; Property = "LibcmtPath" }
    )
    $resolvedLibraries = @{}

    foreach ($library in $requiredLibraries) {
        $resolvedPath = $null
        foreach ($directory in $libraryDirectories) {
            $candidate = Join-Path $directory $library.Name
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $resolvedPath = [IO.Path]::GetFullPath($candidate)
                break
            }
        }
        if (-not $resolvedPath) {
            throw "vcvarsall 已执行，但 LIB 中找不到 $($library.Name)（缺少 $($library.Purpose)）"
        }
        $resolvedLibraries[$library.Property] = $resolvedPath
    }

    return [pscustomobject]@{
        Kernel32Path = $resolvedLibraries.Kernel32Path
        UcrtPath = $resolvedLibraries.UcrtPath
        LibcmtPath = $resolvedLibraries.LibcmtPath
    }
}

function Import-MSVCEnvironment {
    [CmdletBinding()]
    param(
        [ValidateSet("x64")]
        [string]$Architecture = "x64"
    )

    $vsWherePath = Get-VSWherePath
    if (-not $vsWherePath) {
        throw "未找到 Visual Studio Installer 的 vswhere.exe"
    }

    $component = "Microsoft.VisualStudio.Component.VC.Tools.x86.x64"
    $installations = @(& $vsWherePath -latest -products * -requires $component -property installationPath 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw "vswhere 查询失败（exit $LASTEXITCODE）"
    }
    $installationPath = $installations | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
    if (-not $installationPath) {
        throw "未找到包含 $component 的 Visual Studio / Build Tools"
    }

    $installationPath = [string]$installationPath
    $vcvarsallPath = Join-Path $installationPath "VC\Auxiliary\Build\vcvarsall.bat"
    if (-not (Test-Path -LiteralPath $vcvarsallPath -PathType Leaf)) {
        throw "vcvarsall.bat 不存在: $vcvarsallPath"
    }

    $comSpec = if ($env:ComSpec) { $env:ComSpec } else { "$env:SystemRoot\System32\cmd.exe" }
    $environmentDump = & $comSpec /d /c "call `"$vcvarsallPath`" $Architecture >nul && set"
    if ($LASTEXITCODE -ne 0) {
        throw "vcvarsall.bat $Architecture 执行失败（exit $LASTEXITCODE）"
    }

    foreach ($line in $environmentDump) {
        if ($line -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
        }
    }

    $clCommand = Get-Command cl.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $linkCommand = Get-Command link.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $clCommand) {
        throw "vcvarsall 已执行，但 PATH 中仍找不到 cl.exe"
    }
    if (-not $linkCommand) {
        throw "vcvarsall 已执行，但 PATH 中仍找不到 link.exe"
    }

    $validatedCommands = Assert-MSVCCommandPaths `
        -InstallationPath $installationPath `
        -ClPath $clCommand.Source `
        -LinkPath $linkCommand.Source
    $validatedLibraries = Assert-MSVCLinkLibraries -LibraryPath $env:LIB

    return [pscustomobject]@{
        InstallationPath = $validatedCommands.InstallationPath
        ClPath = $validatedCommands.ClPath
        LinkPath = $validatedCommands.LinkPath
        Kernel32Path = $validatedLibraries.Kernel32Path
        UcrtPath = $validatedLibraries.UcrtPath
        LibcmtPath = $validatedLibraries.LibcmtPath
    }
}
