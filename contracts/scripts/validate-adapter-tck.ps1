$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$validationRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('sdlc-factory-tck-' + [guid]::NewGuid().ToString('N'))

try {
    New-Item -ItemType Directory -Path $validationRoot | Out-Null
    & npm install --prefix $validationRoot --no-audit --no-fund ajv@8.17.1 ajv-formats@3.0.1
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to install the temporary TCK validator.'
    }

    $env:SDLC_AJV_MODULE = Join-Path $validationRoot 'node_modules\ajv\dist\2020.js'
    $env:SDLC_AJV_FORMATS_MODULE = Join-Path $validationRoot 'node_modules\ajv-formats\dist\index.js'
    $env:SDLC_CONTRACTS_ROOT = (Resolve-Path -LiteralPath $contractsRoot).Path
    & node (Join-Path $contractsRoot 'tck\run-adapter-tck.mjs')
    if ($LASTEXITCODE -ne 0) {
        throw 'Adapter TCK failed.'
    }
}
finally {
    Remove-Item Env:SDLC_AJV_MODULE -ErrorAction SilentlyContinue
    Remove-Item Env:SDLC_AJV_FORMATS_MODULE -ErrorAction SilentlyContinue
    Remove-Item Env:SDLC_CONTRACTS_ROOT -ErrorAction SilentlyContinue

    if (Test-Path -LiteralPath $validationRoot) {
        $resolved = [System.IO.Path]::GetFullPath($validationRoot)
        $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
        if ($resolved.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
            [System.IO.Path]::GetFileName($resolved) -match '^sdlc-factory-tck-[a-f0-9]{32}$') {
            [System.IO.Directory]::Delete($resolved, $true)
        }
    }
}
