$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$ddlPath = Join-Path $contractsRoot 'ddl\V1__v1_2_contract_baseline.sql'
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
await db.query("insert into review_record(review_id,scope_type,scope_id,stage_type,baseline_candidate_ref,reviewer_identity,reviewer_role,separation_policy,decision,comments,reviewed_at,idempotency_key) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11)", ["REVIEW-REQ-1", "PROJECT", "PROJECT-1", "REQUIREMENT", "ART-REQ-1", "reviewer-1", "REVIEWER", "ENFORCED", "APPROVED", "approved", "IDEMP-REQ-1"]);
await db.query("insert into baseline(baseline_id,scope_type,scope_id,baseline_type,artifact_version,content_hash,review_record_id,validity_status) values ($1,$2,$3,$4,$5,$6,$7,$8)", ["BL-REQ-1", "PROJECT", "PROJECT-1", "REQUIREMENT", 1, hashA, "REVIEW-REQ-1", "VALID"]);
await db.query("insert into capability_unit(cu_id,project_id,name) values ($1,$2,$3)", ["CU-1", "PROJECT-1", "Capability"]);
await db.query("insert into validation_contract(validation_contract_id,version,project_id,derived_from_requirement_baseline_id,content_hash,status) values ($1,$2,$3,$4,$5,$6)", ["VC-1", 1, "PROJECT-1", "BL-REQ-1", hashA, "DRAFT"]);
await db.query("insert into validation_assertion(validation_contract_id,validation_contract_version,assertion_id,scope_type,scope_ref,given_text,when_text,then_text,verification_method,verifier_capability_ref,severity) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", ["VC-1", 1, "VAL-1", "CAPABILITY_UNIT", "CU-1", "given", "when", "then", "TEST", "runtime:test", "BLOCKING"]);
await db.query("insert into run(run_id,project_id,cu_id,attempt_id,status) values ($1,$2,$3,$4,$5)", ["RUN-2", "PROJECT-1", "CU-1", "ATTEMPT-2", "SUCCEEDED"]);
await db.query("insert into capability_index(capability_index_id,project_id,run_id,stage,generated_at) values ($1,$2,$3,$4,now())", ["CI-1", "PROJECT-1", "RUN-1", "CODING"]);
await db.query("insert into capability_index_entry(capability_index_id,entry_id,kind,name,short_description,source_ref,version,authority_class,load_policy,content_hash) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", ["CI-1", "CAP-1", "INTERNAL_TOOL", "source-query", "query source", "registry:source-query", "1.0.0", "EXECUTION_CAPABILITY", "DEFERRED", hashC]);
await db.query("insert into run_request(run_id,attempt_id,protocol_version,idempotency_key,payload_ref,payload_hash,requested_at) values ($1,$2,$3,$4,$5,$6,now())", ["RUN-1", "ATTEMPT-1", "1.0", "RUN-REQUEST-1", "requests/RUN-1.json", hashA]);
await db.query("insert into context_manifest(manifest_id,run_id,attempt_id,total_estimated_tokens,payload,content_hash,assembled_at) values ($1,$2,$3,$4,$5::jsonb,$6,now())", ["CTX-1", "RUN-1", "ATTEMPT-1", 10, "{}", hashB]);
await db.query("insert into agent_invocation(invocation_id,run_id,attempt_id,context_manifest_id,adapter_id,adapter_version,host_version,sdk_version,output_schema_id,output_schema_version,output_schema_hash,payload_ref,payload_hash,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())", ["INV-1", "RUN-1", "ATTEMPT-1", "CTX-1", "opencode-node", "1.0.0", "1.18.10", "1.18.10", "handoff", "1.0.0", hashC, "invocations/INV-1.json", hashF]);
await db.query("insert into handoff(handoff_id,run_id,role,artifact_ref,content_hash,payload,submitted_at) values ($1,$2,$3,$4,$5,$6::jsonb,now())", ["HND-1", "RUN-1", "CODER", "handoffs/HND-1.json", hashA, "{}"]);
await db.query("insert into host_run_event(event_id,run_id,invocation_id,host_session_id,sequence_no,event_type,occurred_at,sanitized,payload) values ($1,$2,$3,$4,$5,$6,now(),true,$7::jsonb)", ["HEV-1", "RUN-1", "INV-1", "session-1", 0, "SESSION_STARTED", "{}"]);

let budgetGuard = false;
try { await db.exec("update factory_run_budget set max_concurrent_runs = 2"); } catch { budgetGuard = true; }

let trajectoryGuard = false;
try { await db.exec("update factory_trajectory_event set outcome = 'FAILED' where event_id = 'TE-1'"); } catch { trajectoryGuard = true; }

let validatorGuard = false;
try { await db.query("insert into validation_finding(finding_id,project_id,cu_id,implementation_run_id,validator_run_id,validation_type,validation_contract_id,validation_contract_version,assertion_id,validator_agent_id,validator_agent_version,validator_agent_content_hash,context_isolation,severity,summary,status,code_mutation_allowed,gate_authority,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())", ["VF-1", "PROJECT-1", "CU-1", "RUN-1", "RUN-2", "SCRUTINY", "VC-1", 1, "VAL-1", "AGT-CODER", "1.0.0", hashB, "FRESH_SESSION", "BLOCKING", "finding", "OPEN", false, true]); } catch { validatorGuard = true; }

let contextGuard = false;
try { await db.query("insert into context_expansion_request(request_id,project_id,run_id,capability_index_id,entry_id,requested_by_agent_id,requested_by_agent_version,requested_by_agent_content_hash,reason,status,decision_reason,decided_at,requested_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())", ["CER-1", "PROJECT-1", "RUN-1", "CI-1", "CAP-1", "AGT-CODER", "1.0.0", hashB, "need source", "LOADED", "approved"]); } catch { contextGuard = true; }

let hostEventGuard = false;
try { await db.exec("update host_run_event set event_type = 'SESSION_IDLE' where event_id = 'HEV-1'"); } catch { hostEventGuard = true; }

let hostResultGuard = false;
try { await db.query("insert into host_run_result(result_id,run_id,invocation_id,host_session_id,status,input_tokens,output_tokens,cost_usd,host_calls,completed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())", ["HRS-1", "RUN-1", "INV-1", "session-1", "SUCCEEDED", 1, 1, 0, 1]); } catch { hostResultGuard = true; }

const tables = await db.query("select count(*)::int as count from pg_tables where schemaname = 'public' and tablename not like 'pglite_%'");
if (tables.rows[0].count !== 61 || !budgetGuard || !trajectoryGuard || !validatorGuard || !contextGuard || !hostEventGuard || !hostResultGuard) {
  throw new Error(JSON.stringify({ contractTables: tables.rows[0].count, budgetGuard, trajectoryGuard, validatorGuard, contextGuard, hostEventGuard, hostResultGuard }));
}

console.log(JSON.stringify({ contractTables: tables.rows[0].count, budgetGuard, trajectoryGuard, validatorGuard, contextGuard, hostEventGuard, hostResultGuard }));
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
