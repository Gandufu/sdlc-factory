$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$ddlPath = Join-Path $contractsRoot 'ddl\v1.2-schema.sql'
$validationRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('sdlc-factory-pglite-' + [guid]::NewGuid().ToString('N'))

try {
    New-Item -ItemType Directory -Path $validationRoot | Out-Null
    & npm install --prefix $validationRoot --no-audit --no-fund @electric-sql/pglite@0.3.7
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to install the temporary PGlite validator.'
    }

    $env:SDLC_PGLITE_MODULE = Join-Path $validationRoot 'node_modules\@electric-sql\pglite\dist\index.js'
    $env:SDLC_DDL_PATH = (Resolve-Path -LiteralPath $ddlPath).Path

    $ErrorActionPreference = 'Continue'
    $nodeOutput = @'
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.env.SDLC_PGLITE_MODULE));
const db = new PGlite();
await db.exec(fs.readFileSync(process.env.SDLC_DDL_PATH, "utf8"));

const hashA = "sha256:" + "a".repeat(64);
const hashB = "sha256:" + "b".repeat(64);
const hashC = "sha256:" + "c".repeat(64);
const hashF = "sha256:" + "f".repeat(64);

await db.query("insert into project(project_id,name) values ($1,$2)", ["PROJECT-1", "Project"]);
await db.query("insert into run(run_id,project_id,attempt_id,status) values ($1,$2,$3,$4)", ["RUN-1", "PROJECT-1", "ATTEMPT-1", "SUCCEEDED"]);
await db.query("insert into prompt_template(prompt_id,version,applicable_stage,content_ref,content_hash,status) values ($1,$2,$3,$4,$5,$6)", ["PRM-CODER", "1.0.0", "CODING", "prompts/coder.md", hashA, "DRAFT"]);
await db.query("insert into agent_definition(agent_id,version,role,model_binding_ref,prompt_id,prompt_version,prompt_content_hash,content_hash,status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)", ["AGT-CODER", "1.0.0", "CODER", "MODEL-1", "PRM-CODER", "1.0.0", hashA, hashB, "DRAFT"]);
await db.query("insert into rule_set(ruleset_id,version,applicable_stage,content_ref,content_hash,status) values ($1,$2,$3,$4,$5,$6)", ["RS-CODER", "1.0.0", "CODING", "rules/coder.md", hashC, "DRAFT"]);
await db.query("insert into factory_trajectory_event(event_id,occurred_at,project_id,run_id,attempt_id,trace_id,agent_id,agent_version,agent_content_hash,prompt_id,prompt_version,prompt_content_hash,ruleset_id,ruleset_version,ruleset_content_hash,model_ref,tool_schema_version,context_bundle_hash,outcome,event_type) values ($1,now(),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)", ["TE-1", "PROJECT-1", "RUN-1", "ATTEMPT-1", "TRACE-1", "AGT-CODER", "1.0.0", hashB, "PRM-CODER", "1.0.0", hashA, "RS-CODER", "1.0.0", hashC, "MODEL-1", "1.0.0", hashF, "PASSED", "RUN_COMPLETED"]);

let budgetGuard = false;
try { await db.exec("update factory_run_budget set max_concurrent_runs = 2"); } catch { budgetGuard = true; }

let trajectoryGuard = false;
try { await db.exec("update factory_trajectory_event set outcome = 'FAILED' where event_id = 'TE-1'"); } catch { trajectoryGuard = true; }

const tables = await db.query("select count(*)::int as count from pg_tables where schemaname = 'public' and tablename not like 'pglite_%'");
if (tables.rows[0].count !== 38 || !budgetGuard || !trajectoryGuard) {
  throw new Error(JSON.stringify({ contractTables: tables.rows[0].count, budgetGuard, trajectoryGuard }));
}

console.log(JSON.stringify({ contractTables: tables.rows[0].count, budgetGuard, trajectoryGuard }));
'@ | node --input-type=module 2>$null
    $nodeExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $nodeOutput | Write-Output

    if ($nodeExitCode -ne 0) {
        throw 'PostgreSQL DDL validation failed.'
    }
}
finally {
    Remove-Item Env:SDLC_PGLITE_MODULE -ErrorAction SilentlyContinue
    Remove-Item Env:SDLC_DDL_PATH -ErrorAction SilentlyContinue

    if (Test-Path -LiteralPath $validationRoot) {
        $resolved = [System.IO.Path]::GetFullPath($validationRoot)
        $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
        if ($resolved.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
            [System.IO.Path]::GetFileName($resolved) -match '^sdlc-factory-pglite-[a-f0-9]{32}$') {
            [System.IO.Directory]::Delete($resolved, $true)
        }
    }
}
