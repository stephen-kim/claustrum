'use client';

import type { MonorepoContextMode, MonorepoMode } from '../lib/types';
import { isSubprojectKey, monorepoModeDescription } from '../lib/utils';
import { Button, Checkbox, Input, Label, Select, Textarea } from './ui';
import type { Props } from './resolution-settings-types';

export function ResolutionSettingsMonorepoSection({ props }: { props: Props }) {
  return (
    <>
      <div className="row">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-monorepo-resolution"
            checked={props.enableMonorepoResolution}
            onCheckedChange={(value) => props.setEnableMonorepoResolution(value === true)}
          />
          <Label htmlFor="enable-monorepo-resolution" className="text-sm text-muted-foreground">
            enable monorepo workspace resolution
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-switch-subproject"
            checked={props.autoSwitchSubproject}
            onCheckedChange={(value) => props.setAutoSwitchSubproject(value === true)}
          />
          <Label htmlFor="auto-switch-subproject" className="text-sm text-muted-foreground">
            auto switch subproject within same repo
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-create-subprojects"
            checked={props.autoCreateProjectSubprojects}
            onCheckedChange={(value) => props.setAutoCreateProjectSubprojects(value === true)}
          />
          <Label htmlFor="auto-create-subprojects" className="text-sm text-muted-foreground">
            auto create subprojects (`repo#subpath`)
          </Label>
        </div>
      </div>

      <div className="stack gap-2 rounded-md border border-border bg-muted/20 p-3">
        <Label className="muted">Monorepo Context</Label>
        <div className="stack gap-1">
          <Label className="muted">Mode</Label>
          <Select
            value={props.monorepoContextMode}
            onChange={(event) => props.setMonorepoContextMode(event.target.value as MonorepoContextMode)}
          >
            <option value="shared_repo">Shared (Repo-level)</option>
            <option value="split_on_demand">Split (On-demand)</option>
            <option value="split_auto">Split (Auto - advanced)</option>
          </Select>
          <div className="muted">
            {props.monorepoContextMode === 'shared_repo'
              ? 'Shared: Memories are shared across the repo. Results are boosted for your current subpath.'
              : props.monorepoContextMode === 'split_on_demand'
                ? 'In Split (On-demand) mode, only listed subpaths are isolated as separate projects.'
                : 'Split (Auto): subprojects can be isolated automatically with guardrails.'}
          </div>
        </div>
        <div className="row">
          <div className="flex items-center gap-2">
            <Checkbox
              id="monorepo-subpath-metadata-enabled"
              checked={props.monorepoSubpathMetadataEnabled}
              onCheckedChange={(value) => props.setMonorepoSubpathMetadataEnabled(value === true)}
            />
            <Label htmlFor="monorepo-subpath-metadata-enabled" className="text-sm text-muted-foreground">
              save subpath metadata
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="monorepo-subpath-boost-enabled"
              checked={props.monorepoSubpathBoostEnabled}
              onCheckedChange={(value) => props.setMonorepoSubpathBoostEnabled(value === true)}
            />
            <Label htmlFor="monorepo-subpath-boost-enabled" className="text-sm text-muted-foreground">
              boost results by current subpath
            </Label>
          </div>
        </div>
        <div className="stack gap-1">
          <Label className="muted">Subpath Boost Weight</Label>
          <Input
            type="number"
            min={1}
            max={10}
            step={0.1}
            value={props.monorepoSubpathBoostWeight}
            onChange={(event) =>
              props.setMonorepoSubpathBoostWeight(
                Math.min(Math.max(Number(event.target.value) || 1.5, 1), 10)
              )
            }
          />
        </div>
      </div>

      {props.monorepoContextMode === 'split_on_demand' ? (
        <div className="stack gap-2 rounded-md border border-border bg-muted/20 p-3">
          <Label className="muted">On-demand Subproject Split List</Label>
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Repo Key</Label>
              <Select
                value={props.newMonorepoPolicyRepoKey}
                onChange={(event) => props.setNewMonorepoPolicyRepoKey(event.target.value)}
              >
                <option value="">Select repo project</option>
                {props.projects
                  .filter((project) => !isSubprojectKey(project.key))
                  .map((project) => (
                    <option key={project.id} value={project.key}>
                      {project.key}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Subpath</Label>
              <Input
                value={props.newMonorepoPolicySubpath}
                onChange={(event) => props.setNewMonorepoPolicySubpath(event.target.value)}
                placeholder="apps/admin-ui"
              />
            </div>
            <div className="flex items-end gap-2">
              <Checkbox
                id="new-monorepo-policy-enabled"
                checked={props.newMonorepoPolicyEnabled}
                onCheckedChange={(value) => props.setNewMonorepoPolicyEnabled(value === true)}
              />
              <Label htmlFor="new-monorepo-policy-enabled" className="text-sm text-muted-foreground">
                enabled
              </Label>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={() => {
                  void props.createMonorepoSubprojectPolicy();
                }}
              >
                Add
              </Button>
            </div>
          </div>
          <div className="stack gap-1">
            <Label className="muted">Reason (for audit log)</Label>
            <Input
              value={props.monorepoPolicyReason}
              onChange={(event) => props.setMonorepoPolicyReason(event.target.value)}
              placeholder="why this subproject split policy changed"
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Repo Key</th>
                  <th>Subpath</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.monorepoSubprojectPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      no subproject split policies
                    </td>
                  </tr>
                ) : (
                  props.monorepoSubprojectPolicies.map((policy) => (
                    <tr key={policy.id}>
                      <td>{policy.repo_key}</td>
                      <td>{policy.subpath}</td>
                      <td>{policy.enabled ? 'yes' : 'no'}</td>
                      <td>
                        <div className="toolbar">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              void props.patchMonorepoSubprojectPolicy(policy.id, !policy.enabled);
                            }}
                          >
                            {policy.enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              void props.removeMonorepoSubprojectPolicy(policy.id);
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
      ) : null}

      <div className="stack gap-1">
        <Label className="muted">Monorepo Detection Level</Label>
        <Select
          value={String(props.monorepoDetectionLevel)}
          onChange={(event) => props.setMonorepoDetectionLevel(Number(event.target.value))}
        >
          <option value="0">0 - off (repo only)</option>
          <option value="1">1 - apps/packages rules only</option>
          <option value="2">2 - workspace globs + apps/packages</option>
          <option value="3">3 - level2 + nearest package.json fallback</option>
        </Select>
      </div>

      <div className="stack gap-1">
        <Label className="muted">Monorepo Mode</Label>
        <Select
          value={props.monorepoMode}
          onChange={(event) => props.setMonorepoMode(event.target.value as MonorepoMode)}
        >
          <option value="repo_only">repo_only</option>
          <option value="repo_hash_subpath">repo_hash_subpath</option>
          <option value="repo_colon_subpath">repo_colon_subpath</option>
        </Select>
        <div className="muted">{monorepoModeDescription(props.monorepoMode)}</div>
      </div>

      <div className="row">
        <div className="stack gap-1">
          <Label className="muted">Workspace Globs (line-separated)</Label>
          <Textarea
            rows={4}
            value={props.monorepoWorkspaceGlobsText}
            onChange={(event) => props.setMonorepoWorkspaceGlobsText(event.target.value)}
            placeholder={'apps/*\npackages/*'}
          />
        </div>
        <div className="stack gap-1">
          <Label className="muted">Exclude Globs (line-separated)</Label>
          <Textarea
            rows={4}
            value={props.monorepoExcludeGlobsText}
            onChange={(event) => props.setMonorepoExcludeGlobsText(event.target.value)}
            placeholder={'**/node_modules/**\n**/.git/**'}
          />
        </div>
      </div>

      <div className="row">
        <div className="stack gap-1">
          <Label className="muted">Monorepo Root Markers (line-separated)</Label>
          <Textarea
            rows={4}
            value={props.monorepoRootMarkersText}
            onChange={(event) => props.setMonorepoRootMarkersText(event.target.value)}
            placeholder={'pnpm-workspace.yaml\nturbo.json'}
          />
        </div>
      </div>

      <div className="stack gap-1">
        <Label className="muted">Monorepo Max Depth</Label>
        <Input
          type="number"
          min={1}
          max={12}
          value={props.monorepoMaxDepth}
          onChange={(event) => props.setMonorepoMaxDepth(Number(event.target.value) || 3)}
        />
      </div>

      <div className="stack gap-2 rounded-md border border-border bg-muted/20 p-3">
        <div className="text-sm font-medium">MCP Pin Mode</div>
        <div className="muted">
          Pin state is session-local in MCP clients. Use `get_current_project` to inspect and
          `unset_project_pin` to release.
        </div>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText('unset_project_pin({})');
            }}
          >
            Copy Unpin Command
          </Button>
        </div>
      </div>
    </>
  );
}
