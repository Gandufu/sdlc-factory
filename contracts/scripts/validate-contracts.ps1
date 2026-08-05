$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$schemaRoot = Join-Path $contractsRoot 'json-schema'
$validRoot = Join-Path $contractsRoot 'examples\valid'
$invalidRoot = Join-Path $contractsRoot 'examples\invalid'

$schemas = Get-ChildItem -LiteralPath $schemaRoot -Filter '*.schema.json' | Sort-Object Name
if ($schemas.Count -eq 0) {
    throw 'No JSON Schema files found.'
}

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

    & npx --yes --package ajv-cli@5 --package ajv-formats@3 ajv test `
        --spec=draft2020 -c ajv-formats -s $schema.FullName -d $validCase --valid
    if ($LASTEXITCODE -ne 0) {
        throw "Valid example failed for $($schema.Name)"
    }

    & npx --yes --package ajv-cli@5 --package ajv-formats@3 ajv test `
        --spec=draft2020 -c ajv-formats -s $schema.FullName -d $invalidCase --invalid
    if ($LASTEXITCODE -ne 0) {
        throw "Invalid example unexpectedly passed for $($schema.Name)"
    }
}

Write-Output "Validated $($schemas.Count) schemas with positive and negative examples."
