$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$schemaRoot = Join-Path $contractsRoot 'json-schema'
$validRoot = Join-Path $contractsRoot 'examples\valid'
$invalidRoot = Join-Path $contractsRoot 'examples\invalid'
$validationRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('sdlc-factory-ajv-' + [guid]::NewGuid().ToString('N'))

$schemas = Get-ChildItem -LiteralPath $schemaRoot -Filter '*.schema.json' | Sort-Object Name
if ($schemas.Count -eq 0) {
    throw 'No JSON Schema files found.'
}

try {
    New-Item -ItemType Directory -Path $validationRoot | Out-Null
    & npm install --prefix $validationRoot --no-audit --no-fund ajv-cli@5 ajv-formats@3
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to install the temporary AJV validator.'
    }
    $ajv = Join-Path $validationRoot 'node_modules\.bin\ajv.cmd'

    foreach ($schema in $schemas) {
        $caseName = $schema.Name -replace '\.schema\.json$', '.json'
        $validCase = Join-Path $validRoot $caseName
        $invalidCase = Join-Path $invalidRoot $caseName

        if (-not (Test-Path -LiteralPath $validCase)) {
            throw "Missing valid example for $($schema.Name)"
        }
        if (-not (Test-Path -LiteralPath $invalidCase)) {
            throw "Missing invalid example for $($schema.Name)"
        }

        & $ajv test --spec=draft2020 -c ajv-formats -s $schema.FullName -d $validCase --valid
        if ($LASTEXITCODE -ne 0) {
            throw "Valid example failed for $($schema.Name)"
        }

        & $ajv test --spec=draft2020 -c ajv-formats -s $schema.FullName -d $invalidCase --invalid
        if ($LASTEXITCODE -ne 0) {
            throw "Invalid example unexpectedly passed for $($schema.Name)"
        }
    }

    Write-Output "Validated $($schemas.Count) schemas with positive and negative examples."
}
finally {
    if (Test-Path -LiteralPath $validationRoot) {
        $resolved = [System.IO.Path]::GetFullPath($validationRoot)
        $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
        if ($resolved.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
            [System.IO.Path]::GetFileName($resolved) -match '^sdlc-factory-ajv-[a-f0-9]{32}$') {
            [System.IO.Directory]::Delete($resolved, $true)
        }
    }
}
