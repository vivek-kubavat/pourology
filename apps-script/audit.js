/** Append-only audit trail. Every write action records who did what, with before/after snapshots. */
function audit_(user, action, entity, entityId, before, after) {
  append_('AUDIT_LOG', {
    log_id: newId_('LOG'),
    timestamp: nowIso_(),
    user_email: user.email,
    action: action,
    entity: entity,
    entity_id: entityId || '',
    before_json: before ? JSON.stringify(before) : '',
    after_json: after ? JSON.stringify(after) : '',
  });
}

function listAudit(user, p) {
  const limit = Math.min(Number(p.limit) || 200, 1000);
  let rows = readAll_('AUDIT_LOG').map(strip_);
  if (p.entity) rows = rows.filter((r) => r.entity === p.entity);
  return rows.reverse().slice(0, limit);
}
