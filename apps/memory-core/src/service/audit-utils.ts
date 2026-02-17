export function normalizeReason(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const value = input.trim();
  if (!value) {
    return null;
  }
  return value.length > 500 ? value.slice(0, 500) : value;
}

export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export function withAutoReason(action: string, target: Record<string, unknown>): Record<string, unknown> {
  const existing = normalizeReason(target.reason);
  if (existing) {
    return {
      ...target,
      reason: existing,
      reason_source: 'user',
    };
  }
  return {
    ...target,
    reason: buildAutoReason(action, target),
    reason_source: 'heuristic',
  };
}

function buildAutoReason(action: string, target: Record<string, unknown>): string {
  if (action === 'workspace_settings.update') {
    return 'Automatic reason: workspace resolution settings were updated.';
  }
  if (action === 'project_mapping.create') {
    const kind = asString(target.kind) || 'unknown';
    const externalId = asString(target.external_id) || 'unknown';
    return `Automatic reason: created project mapping (${kind}) for selector "${externalId}".`;
  }
  if (action === 'project_mapping.update') {
    return 'Automatic reason: project mapping configuration was updated.';
  }
  if (action === 'integration.update') {
    const provider = asString(target.provider) || 'unknown';
    return `Automatic reason: ${provider} integration settings were updated.`;
  }
  if (action === 'git.commit') {
    return 'Automatic reason: git post-commit hook event captured.';
  }
  if (action === 'git.merge') {
    return 'Automatic reason: git post-merge hook event captured.';
  }
  if (action === 'git.checkout') {
    return 'Automatic reason: git post-checkout hook event captured.';
  }
  if (action === 'integration.autowrite') {
    const provider = asString(target.provider) || 'unknown';
    const trigger = asString(target.trigger) || 'unknown';
    return `Automatic reason: ${provider} auto-write triggered by git ${trigger} event.`;
  }
  if (action === 'ci.success') {
    const workflowName = asString(target.workflow_name) || 'unknown workflow';
    return `Automatic reason: CI workflow "${workflowName}" completed successfully.`;
  }
  if (action === 'ci.failure') {
    const workflowName = asString(target.workflow_name) || 'unknown workflow';
    return `Automatic reason: CI workflow "${workflowName}" reported a failure.`;
  }
  if (action.endsWith('.search')) {
    const query = asString(target.query);
    if (query) {
      return `Automatic reason: search requested for "${truncateForReason(query)}".`;
    }
    return 'Automatic reason: search requested by authorized user.';
  }
  if (action.endsWith('.read')) {
    return 'Automatic reason: detail read requested by authorized user.';
  }
  if (action.endsWith('.write')) {
    return 'Automatic reason: write operation requested by authorized user.';
  }
  if (action === 'raw.view') {
    return 'Automatic reason: raw message snippet view requested by authorized user.';
  }
  return `Automatic reason: action "${action}" requested by authorized user.`;
}

function asString(input: unknown): string | undefined {
  return typeof input === 'string' && input.trim() ? input.trim() : undefined;
}

function truncateForReason(input: string): string {
  return input.length > 80 ? `${input.slice(0, 80)}...` : input;
}
