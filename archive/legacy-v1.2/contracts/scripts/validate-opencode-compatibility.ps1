$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$opencode = Get-Command opencode -ErrorAction SilentlyContinue
if (-not $opencode) {
    throw 'OpenCode CLI is not installed or is not on PATH.'
}

$version = (& opencode --version).Trim()
if ($LASTEXITCODE -ne 0 -or $version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Unable to resolve a semantic OpenCode CLI version: $version"
}

$validationRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('sdlc-factory-opencode-' + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $validationRoot | Out-Null
    & npm install --prefix $validationRoot --no-audit --no-fund "@opencode-ai/sdk@$version"
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to install @opencode-ai/sdk@$version."
    }

    $env:SDLC_OPENCODE_SDK_ENTRY = Join-Path $validationRoot 'node_modules\@opencode-ai\sdk\dist\v2\index.js'
    $env:SDLC_OPENCODE_EXPECTED_VERSION = $version
    $env:SDLC_OPENCODE_SPIKE_DIR = $validationRoot
    & node (Join-Path $contractsRoot 'tck\opencode\run-opencode-compatibility.mjs')
    if ($LASTEXITCODE -ne 0) {
        throw 'OpenCode compatibility validation failed.'
    }
}
finally {
    Remove-Item Env:SDLC_OPENCODE_SDK_ENTRY -ErrorAction SilentlyContinue
    Remove-Item Env:SDLC_OPENCODE_EXPECTED_VERSION -ErrorAction SilentlyContinue
    Remove-Item Env:SDLC_OPENCODE_SPIKE_DIR -ErrorAction SilentlyContinue

    if (Test-Path -LiteralPath $validationRoot) {
        $resolved = [System.IO.Path]::GetFullPath($validationRoot)
        $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
        if ($resolved.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
            [System.IO.Path]::GetFileName($resolved) -match '^sdlc-factory-opencode-[a-f0-9]{32}$') {
            [System.IO.Directory]::Delete($resolved, $true)
        }
    }
}
