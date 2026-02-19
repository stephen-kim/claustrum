
'use client';

import type { IntegrationsPanelProps } from './types';
import { Button, Input, Label, Select } from '../ui';

type SectionProps = {
  props: IntegrationsPanelProps;
  handleCreateGithubUserLink: () => void;
  handlePreviewGithubPermissions: (repoFullName: string) => void;
  handleRecomputeGithubRepo: (repoFullName: string) => void;
};

export function GithubLinksReposSection({
  props,
  handleCreateGithubUserLink,
  handlePreviewGithubPermissions,
  handleRecomputeGithubRepo,
}: SectionProps) {
  return (
    <>
<hr className="border-border/60" />
            <strong>User Links</strong>
            <div className="row">
              <label className="stack gap-1">
                <Label className="muted">Workspace user</Label>
                <Select
                  value={props.githubLinkUserId}
                  onChange={(event) => props.setGithubLinkUserId(event.target.value)}
                >
                  <option value="">Select member</option>
                  {props.workspaceMembers.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.email}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="stack gap-1">
                <Label className="muted">GitHub login</Label>
                <Input
                  value={props.githubLinkLogin}
                  onChange={(event) => props.setGithubLinkLogin(event.target.value)}
                  placeholder="octocat"
                />
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={() => {
                    void handleCreateGithubUserLink();
                  }}
                >
                  Link user
                </Button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>GitHub login</th>
                    <th>GitHub user id</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {props.githubUserLinks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        no linked users
                      </td>
                    </tr>
                  ) : (
                    props.githubUserLinks.map((link) => (
                      <tr key={link.user_id}>
                        <td>{link.user_email}</td>
                        <td>{link.github_login}</td>
                        <td>{link.github_user_id || '-'}</td>
                        <td>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              void props.deleteGithubUserLink(props.selectedWorkspace, link.user_id);
                            }}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {(props.githubLastPermissionSyncResult?.unmatched_users || props.githubPermissionStatus?.unmatched_users)
              ?.length ? (
              <div style={{ overflowX: 'auto' }}>
                <div className="muted">Unmatched GitHub users</div>
                <table>
                  <thead>
                    <tr>
                      <th>Repo</th>
                      <th>Login</th>
                      <th>User ID</th>
                      <th>Permission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(props.githubLastPermissionSyncResult?.unmatched_users ||
                      props.githubPermissionStatus?.unmatched_users ||
                      []
                    ).slice(0, 50).map((row, index) => (
                      <tr key={`${row.repo_full_name}-${row.github_login}-${index}`}>
                        <td>{row.repo_full_name}</td>
                        <td>{row.github_login || '-'}</td>
                        <td>{row.github_user_id || '-'}</td>
                        <td>{row.permission}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          {props.githubLastSyncSummary ? (
            <div className="muted">
              Last sync: {props.githubLastSyncSummary.count} repos, auto-created{' '}
              {props.githubLastSyncSummary.projects_auto_created} projects, auto-linked{' '}
              {props.githubLastSyncSummary.projects_auto_linked} repos.
            </div>
          ) : null}
          {props.githubInstallUrl ? (
            <div className="muted">
              last install URL:{' '}
              <a href={props.githubInstallUrl} target="_blank" rel="noreferrer">
                {props.githubInstallUrl}
              </a>
            </div>
          ) : null}
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Visibility</th>
                  <th>Default Branch</th>
                  <th>Linked Project</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.githubRepos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      no synced repos
                    </td>
                  </tr>
                ) : (
                  props.githubRepos.map((repo) => (
                    <tr key={repo.github_repo_id}>
                      <td>{repo.full_name}</td>
                      <td>{repo.private ? 'private' : 'public'}</td>
                      <td>{repo.default_branch || '-'}</td>
                      <td>{repo.linked_project_key || '-'}</td>
                      <td>
                        <div className="toolbar">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              void handlePreviewGithubPermissions(repo.full_name);
                            }}
                          >
                            Preview permissions
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              void handleRecomputeGithubRepo(repo.full_name);
                            }}
                          >
                            Recompute repo
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {props.githubPermissionPreview ? (
            <div className="stack">
              <div className="muted">
                Permission preview: {props.githubPermissionPreview.repo_full_name} {'->'}{' '}
                {props.githubPermissionPreview.project_key || '-'}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>GitHub User ID</th>
                      <th>GitHub Login</th>
                      <th>Permission</th>
                      <th>Matched User</th>
                      <th>Mapped Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.githubPermissionPreview.computed_permissions.slice(0, 200).map((row) => (
                      <tr key={`${row.github_user_id}-${row.permission}`}>
                        <td>{row.github_user_id}</td>
                        <td>{row.github_login || '-'}</td>
                        <td>{row.permission}</td>
                        <td>{row.matched_user_email || row.matched_user_id || '-'}</td>
                        <td>{row.mapped_project_role || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
    </>
  );
}
