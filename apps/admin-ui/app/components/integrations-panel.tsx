'use client';

import type { IntegrationsPanelProps } from './integrations-panel/types';
import {
  GithubLinksReposSection,
} from './integrations-panel/github-links-repos-section';
import { ProviderCoreSection } from './integrations-panel/provider-core-section';
import { ProviderExtendedSection } from './integrations-panel/provider-extended-section';
import { SiemDetectionsSection } from './integrations-panel/siem-detections-section';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from './ui';

export function IntegrationsPanel(props: IntegrationsPanelProps) {
  async function handleConnectGithub() {
    if (!props.selectedWorkspace) {
      return;
    }
    const url = await props.generateGithubInstallUrl(props.selectedWorkspace);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async function handleSyncGithubRepos() {
    if (!props.selectedWorkspace) {
      return;
    }
    await props.syncGithubRepos(props.selectedWorkspace);
  }

  async function handleSyncGithubPermissions(dryRun: boolean) {
    if (!props.selectedWorkspace) {
      return;
    }
    await props.syncGithubPermissions({
      workspaceKey: props.selectedWorkspace,
      dryRun,
      projectKeyPrefix: props.githubProjectKeyPrefix,
    });
  }

  async function handleRecomputeGithubRepo(repoFullName: string) {
    if (!props.selectedWorkspace) {
      return;
    }
    await props.syncGithubPermissions({
      workspaceKey: props.selectedWorkspace,
      dryRun: false,
      projectKeyPrefix: props.githubProjectKeyPrefix,
      repos: [repoFullName],
    });
  }

  async function handlePreviewGithubPermissions(repoFullName: string) {
    if (!props.selectedWorkspace) {
      return;
    }
    await props.previewGithubPermissions(props.selectedWorkspace, repoFullName);
  }

  async function handleRefreshGithubCacheStatus() {
    if (!props.selectedWorkspace) {
      return;
    }
    await props.loadGithubCacheStatus(props.selectedWorkspace);
  }

  async function handleRefreshAuditDeliveries() {
    if (!props.selectedWorkspace) {
      return;
    }
    await props.loadAuditDeliveries(props.selectedWorkspace);
  }

  async function handleCreateAuditSink() {
    if (!props.selectedWorkspace) {
      return;
    }
    await props.createAuditSink();
  }

  async function handleCreateDetectionRule() {
    if (!props.selectedWorkspace) {
      return;
    }
    await props.createDetectionRule();
  }

  async function handleCreateGithubUserLink() {
    if (!props.selectedWorkspace || !props.githubLinkUserId.trim() || !props.githubLinkLogin.trim()) {
      return;
    }
    await props.createGithubUserLink(
      props.selectedWorkspace,
      props.githubLinkUserId,
      props.githubLinkLogin
    );
    props.setGithubLinkLogin('');
  }

  async function handleCreateGithubTeamMapping() {
    if (
      !props.selectedWorkspace ||
      !props.githubTeamMappingTeamId.trim() ||
      !props.githubTeamMappingTeamSlug.trim() ||
      !props.githubTeamMappingOrgLogin.trim() ||
      !props.githubTeamMappingTargetKey.trim()
    ) {
      return;
    }

    await props.createGithubTeamMapping({
      workspaceKey: props.selectedWorkspace,
      input: {
        providerInstallationId: props.githubTeamMappingProviderInstallationId.trim() || null,
        githubTeamId: props.githubTeamMappingTeamId.trim(),
        githubTeamSlug: props.githubTeamMappingTeamSlug.trim(),
        githubOrgLogin: props.githubTeamMappingOrgLogin.trim(),
        targetType: props.githubTeamMappingTargetType,
        targetKey: props.githubTeamMappingTargetKey.trim(),
        role: props.githubTeamMappingRole,
        enabled: props.githubTeamMappingEnabledState,
        priority: Number(props.githubTeamMappingPriority || '100'),
      },
    });
    props.setGithubTeamMappingTeamId('');
    props.setGithubTeamMappingTeamSlug('');
    props.setGithubTeamMappingTargetKey('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Integrations (Notion / Jira / Confluence / Linear / Slack / Audit Reasoner)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="stack">
          <strong>GitHub App (Workspace Connection)</strong>
          <div className="muted">
            status: {props.githubInstallation ? 'connected' : 'not connected'} · account:{' '}
            {props.githubInstallation?.account_login || '-'} · selection:{' '}
            {props.githubInstallation?.repository_selection || '-'}
          </div>
          <div className="toolbar">
            <Button
              className="primary"
              type="button"
              disabled={!props.selectedWorkspace}
              onClick={() => {
                void handleConnectGithub();
              }}
            >
              Connect GitHub App
            </Button>
            <Button
              type="button"
              disabled={!props.selectedWorkspace || !props.githubInstallation}
              onClick={() => {
                void handleSyncGithubRepos();
              }}
            >
              Sync repos
            </Button>
            <Button
              type="button"
              disabled={!props.selectedWorkspace}
              onClick={() => {
                void props.saveGithubProjectSettings();
              }}
            >
              Save GitHub settings
            </Button>
          </div>
          <div className="stack">
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.githubAutoCreateProjects}
                onChange={(event) => props.setGithubAutoCreateProjects(event.target.checked)}
              />{' '}
              Auto-create repo projects during sync
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.githubAutoCreateSubprojects}
                disabled={props.monorepoContextMode !== 'split_auto'}
                onChange={(event) => props.setGithubAutoCreateSubprojects(event.target.checked)}
              />{' '}
              Auto-create subprojects in split mode only
            </label>
            <label className="stack gap-1">
              <Label className="muted">Project key prefix</Label>
              <Input
                value={props.githubProjectKeyPrefix}
                onChange={(event) => {
                  props.setGithubProjectKeyPrefix(event.target.value);
                  props.setGithubPrefix(event.target.value);
                }}
                placeholder="github:"
              />
            </label>
            <div className="muted">
              {props.monorepoContextMode === 'shared_repo'
                ? 'Shared: All subpaths share a single repo-level project.'
                : 'Split: Subprojects can be isolated as repo#subpath projects.'}
            </div>
            <hr className="border-border/60" />
            <strong>Permission Sync</strong>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.githubPermissionSyncEnabled}
                onChange={(event) => props.setGithubPermissionSyncEnabled(event.target.checked)}
              />{' '}
              Enable GitHub permission sync
            </label>
            <label className="stack gap-1">
              <Label className="muted">Sync mode</Label>
                <Select
                value={props.githubPermissionSyncMode}
                onChange={(event) =>
                  props.setGithubPermissionSyncMode(
                    event.target.value as IntegrationsPanelProps['githubPermissionSyncMode']
                  )
                }
              >
                <option value="add_only">add_only</option>
                <option value="add_and_remove">add_and_remove</option>
              </Select>
            </label>
            <label className="stack gap-1">
              <Label className="muted">Cache TTL (seconds)</Label>
              <Input
                type="number"
                min={30}
                max={86400}
                value={props.githubCacheTtlSeconds}
                onChange={(event) => props.setGithubCacheTtlSeconds(Number(event.target.value || '900'))}
              />
            </label>
            <label className="stack gap-1">
              <Label className="muted">Role mapping (JSON)</Label>
              <Textarea
                value={props.githubRoleMappingJson}
                onChange={(event) => props.setGithubRoleMappingJson(event.target.value)}
                rows={6}
              />
            </label>
            <div className="toolbar">
              <Button
                type="button"
                disabled={!props.selectedWorkspace || !props.githubInstallation}
                onClick={() => {
                  void handleSyncGithubPermissions(true);
                }}
              >
                Dry-run permissions
              </Button>
              <Button
                type="button"
                disabled={!props.selectedWorkspace || !props.githubInstallation}
                onClick={() => {
                  void handleSyncGithubPermissions(false);
                }}
              >
                Recompute all
              </Button>
            </div>
            {props.githubPermissionStatus?.last_sync ? (
              <div className="muted">
                Last permission sync: {new Date(props.githubPermissionStatus.last_sync.created_at).toLocaleString()}
                {' · '}repos {props.githubPermissionStatus.last_sync.repos_processed}
                {' · '}matched {props.githubPermissionStatus.last_sync.users_matched}
                {' · '}added {props.githubPermissionStatus.last_sync.added}
                {' · '}updated {props.githubPermissionStatus.last_sync.updated}
                {' · '}removed {props.githubPermissionStatus.last_sync.removed}
              </div>
            ) : (
              <div className="muted">Last permission sync: no runs yet.</div>
            )}
            {props.githubLastPermissionSyncResult ? (
              <div className="muted">
                Latest run ({props.githubLastPermissionSyncResult.dry_run ? 'dry-run' : 'apply'}):
                {' '}added {props.githubLastPermissionSyncResult.added}, updated{' '}
                {props.githubLastPermissionSyncResult.updated}, removed{' '}
                {props.githubLastPermissionSyncResult.removed}, unmatched{' '}
                {props.githubLastPermissionSyncResult.skipped_unmatched}
              </div>
            ) : null}
            <div className="toolbar">
              <Button
                type="button"
                disabled={!props.selectedWorkspace}
                onClick={() => {
                  void handleRefreshGithubCacheStatus();
                }}
              >
                Refresh cache status
              </Button>
            </div>
            {props.githubPermissionCacheStatus ? (
              <div className="muted">
                Cache status: ttl {props.githubPermissionCacheStatus.ttl_seconds}s · repo teams{' '}
                {props.githubPermissionCacheStatus.repo_teams_cache_count} · team members{' '}
                {props.githubPermissionCacheStatus.team_members_cache_count} · permission rows{' '}
                {props.githubPermissionCacheStatus.permission_cache_count}
              </div>
            ) : null}

            <hr className="border-border/60" />
            <strong>Webhook + Team Mapping</strong>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.githubWebhookEnabled}
                onChange={(event) => props.setGithubWebhookEnabled(event.target.checked)}
              />{' '}
              Enable webhook-driven sync
            </label>
            <label className="stack gap-1">
              <Label className="muted">Webhook sync mode</Label>
              <Select
                value={props.githubWebhookSyncMode}
                onChange={(event) =>
                  props.setGithubWebhookSyncMode(
                    event.target.value as IntegrationsPanelProps['githubWebhookSyncMode']
                  )
                }
              >
                <option value="add_only">add_only</option>
                <option value="add_and_remove">add_and_remove</option>
              </Select>
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.githubTeamMappingEnabled}
                onChange={(event) => props.setGithubTeamMappingEnabled(event.target.checked)}
              />{' '}
              Enable team mapping
            </label>
            <div className="muted">
              Webhook endpoint: <code>/v1/webhooks/github</code> (set secret via <code>GITHUB_APP_WEBHOOK_SECRET</code>)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Delivery</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Affected Repos</th>
                    <th>Updated</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {props.githubWebhookDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        no webhook deliveries
                      </td>
                    </tr>
                  ) : (
                    props.githubWebhookDeliveries.slice(0, 20).map((delivery) => (
                      <tr key={delivery.id}>
                        <td>{delivery.delivery_id}</td>
                        <td>{delivery.event_type}</td>
                        <td>{delivery.status}</td>
                        <td>{delivery.affected_repos_count}</td>
                        <td>{new Date(delivery.updated_at).toLocaleString()}</td>
                        <td>{delivery.error || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="stack">
              <strong>GitHub Team Mappings</strong>
              <div className="row">
                <Input
                  value={props.githubTeamMappingProviderInstallationId}
                  onChange={(event) =>
                    props.setGithubTeamMappingProviderInstallationId(event.target.value)
                  }
                  placeholder="installation id (optional)"
                />
                <Input
                  value={props.githubTeamMappingOrgLogin}
                  onChange={(event) => props.setGithubTeamMappingOrgLogin(event.target.value)}
                  placeholder="org login"
                />
                <Input
                  value={props.githubTeamMappingTeamSlug}
                  onChange={(event) => props.setGithubTeamMappingTeamSlug(event.target.value)}
                  placeholder="team slug"
                />
                <Input
                  value={props.githubTeamMappingTeamId}
                  onChange={(event) => props.setGithubTeamMappingTeamId(event.target.value)}
                  placeholder="team id"
                />
              </div>
              <div className="row">
                <Select
                  value={props.githubTeamMappingTargetType}
                  onChange={(event) =>
                    props.setGithubTeamMappingTargetType(
                      event.target.value as 'workspace' | 'project'
                    )
                  }
                >
                  <option value="workspace">workspace</option>
                  <option value="project">project</option>
                </Select>
                <Input
                  value={props.githubTeamMappingTargetKey}
                  onChange={(event) => props.setGithubTeamMappingTargetKey(event.target.value)}
                  placeholder="target key (workspace or project key)"
                />
                <Select
                  value={props.githubTeamMappingRole}
                  onChange={(event) =>
                    props.setGithubTeamMappingRole(
                      event.target.value as
                        | 'OWNER'
                        | 'ADMIN'
                        | 'MEMBER'
                        | 'MAINTAINER'
                        | 'WRITER'
                        | 'READER'
                    )
                  }
                >
                  {props.githubTeamMappingTargetType === 'workspace' ? (
                    <>
                      <option value="OWNER">OWNER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                    </>
                  ) : (
                    <>
                      <option value="OWNER">OWNER</option>
                      <option value="MAINTAINER">MAINTAINER</option>
                      <option value="WRITER">WRITER</option>
                      <option value="READER">READER</option>
                    </>
                  )}
                </Select>
                <Input
                  value={props.githubTeamMappingPriority}
                  onChange={(event) => props.setGithubTeamMappingPriority(event.target.value)}
                  placeholder="priority"
                />
                <label className="muted">
                  <Input
                    type="checkbox"
                    checked={props.githubTeamMappingEnabledState}
                    onChange={(event) => props.setGithubTeamMappingEnabledState(event.target.checked)}
                  />{' '}
                  enabled
                </label>
                <Button
                  type="button"
                  onClick={() => {
                    void handleCreateGithubTeamMapping();
                  }}
                >
                  Add mapping
                </Button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Org/Team</th>
                      <th>Team ID</th>
                      <th>Target</th>
                      <th>Role</th>
                      <th>Priority</th>
                      <th>Enabled</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.githubTeamMappings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="muted">
                          no team mappings
                        </td>
                      </tr>
                    ) : (
                      props.githubTeamMappings.map((mapping) => (
                        <tr key={mapping.id}>
                          <td>{mapping.github_org_login}/{mapping.github_team_slug}</td>
                          <td>{mapping.github_team_id}</td>
                          <td>{mapping.target_type}:{mapping.target_key}</td>
                          <td>{mapping.role}</td>
                          <td>{mapping.priority}</td>
                          <td>{mapping.enabled ? 'yes' : 'no'}</td>
                          <td>
                            <div className="toolbar">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  void props.patchGithubTeamMapping({
                                    workspaceKey: props.selectedWorkspace,
                                    mappingId: mapping.id,
                                    input: { enabled: !mapping.enabled },
                                  });
                                }}
                              >
                                Toggle
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  void props.deleteGithubTeamMapping(props.selectedWorkspace, mapping.id);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <SiemDetectionsSection
              props={props}
              handleCreateAuditSink={() => {
                void handleCreateAuditSink();
              }}
              handleRefreshAuditDeliveries={() => {
                void handleRefreshAuditDeliveries();
              }}
              handleCreateDetectionRule={() => {
                void handleCreateDetectionRule();
              }}
            />

            <GithubLinksReposSection
              props={props}
              handleCreateGithubUserLink={() => {
                void handleCreateGithubUserLink();
              }}
              handlePreviewGithubPermissions={(repoFullName) => {
                void handlePreviewGithubPermissions(repoFullName);
              }}
              handleRecomputeGithubRepo={(repoFullName) => {
                void handleRecomputeGithubRepo(repoFullName);
              }}
            />
          </div>
        </div>
        <ProviderCoreSection props={props} />

        <ProviderExtendedSection props={props} />
      </CardContent>
    </Card>
  );
}
