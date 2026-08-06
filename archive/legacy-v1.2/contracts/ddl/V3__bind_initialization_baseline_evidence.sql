-- 将 V2 之后已经批准的初始化基线补齐为可复现的不可变证据集合。

INSERT INTO baseline_item(baseline_id, artifact_type, artifact_ref, content_hash)
SELECT b.baseline_id, 'INITIALIZATION_EVIDENCE', e.evidence_id, e.content_hash
FROM baseline b
JOIN project_initialization i ON i.project_id = b.scope_id
JOIN evidence e ON e.run_id = i.run_id
WHERE b.baseline_type = 'INITIALIZATION'
ON CONFLICT DO NOTHING;

INSERT INTO baseline_item(baseline_id, artifact_type, artifact_ref, content_hash)
SELECT b.baseline_id, 'TEMPLATE_DESCRIPTOR', tb.template_id || '@' || tb.template_version, tb.template_digest
FROM baseline b JOIN template_binding tb ON tb.project_id = b.scope_id
WHERE b.baseline_type = 'INITIALIZATION'
ON CONFLICT DO NOTHING;

INSERT INTO baseline_item(baseline_id, artifact_type, artifact_ref, content_hash)
SELECT b.baseline_id, 'TEMPLATE_PARAMETERS', 'parameters', i.template_parameters_hash
FROM baseline b JOIN project_initialization i ON i.project_id = b.scope_id
WHERE b.baseline_type = 'INITIALIZATION'
ON CONFLICT DO NOTHING;

INSERT INTO baseline_item(baseline_id, artifact_type, artifact_ref, content_hash)
SELECT baseline_id, 'PROJECT_MANIFEST', 'project-manifest', content_hash
FROM baseline WHERE baseline_type = 'INITIALIZATION'
ON CONFLICT DO NOTHING;

INSERT INTO baseline_reference_binding(baseline_id, reference_binding_ref)
SELECT b.baseline_id, 'template:' || tb.template_id || '@' || tb.template_version || ':' || tb.template_digest
FROM baseline b JOIN template_binding tb ON tb.project_id = b.scope_id
WHERE b.baseline_type = 'INITIALIZATION'
ON CONFLICT DO NOTHING;
