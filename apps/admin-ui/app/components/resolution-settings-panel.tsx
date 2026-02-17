'use client';

import type { MonorepoMode, ResolutionKind } from '../lib/types';
import { kindDescription, monorepoModeDescription, reorderKinds } from '../lib/utils';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  Textarea,
} from './ui';

type Props = {
  resolutionOrder: ResolutionKind[];
  setResolutionOrder: (order: ResolutionKind[]) => void;
  autoCreateProject: boolean;
  setAutoCreateProject: (value: boolean) => void;
  autoCreateProjectSubprojects: boolean;
  setAutoCreateProjectSubprojects: (value: boolean) => void;
  autoSwitchRepo: boolean;
  setAutoSwitchRepo: (value: boolean) => void;
  autoSwitchSubproject: boolean;
  setAutoSwitchSubproject: (value: boolean) => void;
  allowManualPin: boolean;
  setAllowManualPin: (value: boolean) => void;
  enableGitEvents: boolean;
  setEnableGitEvents: (value: boolean) => void;
  enableCommitEvents: boolean;
  setEnableCommitEvents: (value: boolean) => void;
  enableMergeEvents: boolean;
  setEnableMergeEvents: (value: boolean) => void;
  enableCheckoutEvents: boolean;
  setEnableCheckoutEvents: (value: boolean) => void;
  checkoutDebounceSeconds: number;
  setCheckoutDebounceSeconds: (value: number) => void;
  checkoutDailyLimit: number;
  setCheckoutDailyLimit: (value: number) => void;
  enableAutoExtraction: boolean;
  setEnableAutoExtraction: (value: boolean) => void;
  autoExtractionMode: 'draft_only' | 'auto_confirm';
  setAutoExtractionMode: (value: 'draft_only' | 'auto_confirm') => void;
  autoConfirmMinConfidence: number;
  setAutoConfirmMinConfidence: (value: number) => void;
  autoConfirmAllowedEventTypesText: string;
  setAutoConfirmAllowedEventTypesText: (value: string) => void;
  autoConfirmKeywordAllowlistText: string;
  setAutoConfirmKeywordAllowlistText: (value: string) => void;
  autoConfirmKeywordDenylistText: string;
  setAutoConfirmKeywordDenylistText: (value: string) => void;
  autoExtractionBatchSize: number;
  setAutoExtractionBatchSize: (value: number) => void;
  searchDefaultMode: 'hybrid' | 'keyword' | 'semantic';
  setSearchDefaultMode: (value: 'hybrid' | 'keyword' | 'semantic') => void;
  searchHybridAlpha: number;
  setSearchHybridAlpha: (value: number) => void;
  searchHybridBeta: number;
  setSearchHybridBeta: (value: number) => void;
  searchDefaultLimit: number;
  setSearchDefaultLimit: (value: number) => void;
  githubPrefix: string;
  setGithubPrefix: (value: string) => void;
  localPrefix: string;
  setLocalPrefix: (value: string) => void;
  enableMonorepoResolution: boolean;
  setEnableMonorepoResolution: (value: boolean) => void;
  monorepoDetectionLevel: number;
  setMonorepoDetectionLevel: (value: number) => void;
  monorepoMode: MonorepoMode;
  setMonorepoMode: (value: MonorepoMode) => void;
  monorepoWorkspaceGlobsText: string;
  setMonorepoWorkspaceGlobsText: (value: string) => void;
  monorepoExcludeGlobsText: string;
  setMonorepoExcludeGlobsText: (value: string) => void;
  monorepoRootMarkersText: string;
  setMonorepoRootMarkersText: (value: string) => void;
  monorepoMaxDepth: number;
  setMonorepoMaxDepth: (value: number) => void;
  workspaceSettingsReason: string;
  setWorkspaceSettingsReason: (value: string) => void;
  saveWorkspaceSettings: () => Promise<void>;
  draggingKind: ResolutionKind | null;
  setDraggingKind: (kind: ResolutionKind | null) => void;
};

const DEFAULT_ORDER: ResolutionKind[] = ['github_remote', 'repo_root_slug', 'manual'];

export function ResolutionSettingsPanel(props: Props) {
  function onDropOn(kind: ResolutionKind) {
    if (!props.draggingKind || props.draggingKind === kind) {
      return;
    }
    props.setResolutionOrder(reorderKinds(props.resolutionOrder, props.draggingKind, kind));
    props.setDraggingKind(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Resolution Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="muted">Drag to reorder: 1 &gt; 2 &gt; 3</div>
        <div className="drag-list">
          {props.resolutionOrder.map((kind) => (
            <div
              key={kind}
              className="drag-item"
              draggable
              onDragStart={() => props.setDraggingKind(kind)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDropOn(kind)}
            >
              <strong>{kind}</strong>
              <div className="muted">{kindDescription(kind)}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-create-project"
            checked={props.autoCreateProject}
            onCheckedChange={(value) => props.setAutoCreateProject(value === true)}
          />
          <Label htmlFor="auto-create-project" className="text-sm text-muted-foreground">
            auto create project when mapping is missing
          </Label>
        </div>
        <div className="row">
          <div className="stack gap-1">
            <Label className="muted">GitHub Prefix</Label>
            <Input
              value={props.githubPrefix}
              onChange={(event) => props.setGithubPrefix(event.target.value)}
              placeholder="github:"
            />
          </div>
          <div className="stack gap-1">
            <Label className="muted">Local Prefix</Label>
            <Input
              value={props.localPrefix}
              onChange={(event) => props.setLocalPrefix(event.target.value)}
              placeholder="local:"
            />
          </div>
        </div>
        <div className="stack gap-1">
          <Label className="muted">Reason (for audit log)</Label>
          <Input
            value={props.workspaceSettingsReason}
            onChange={(event) => props.setWorkspaceSettingsReason(event.target.value)}
            placeholder="why this setting changed"
          />
        </div>
        <div className="toolbar">
          <Button type="button" onClick={() => void props.saveWorkspaceSettings()}>
            Save Resolution Settings
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              props.setResolutionOrder(DEFAULT_ORDER);
              props.setAutoCreateProject(true);
              props.setAutoSwitchRepo(true);
              props.setAutoSwitchSubproject(false);
              props.setAllowManualPin(true);
              props.setEnableGitEvents(true);
              props.setEnableCommitEvents(true);
              props.setEnableMergeEvents(true);
              props.setEnableCheckoutEvents(false);
              props.setCheckoutDebounceSeconds(30);
              props.setCheckoutDailyLimit(200);
              props.setEnableAutoExtraction(true);
              props.setAutoExtractionMode('draft_only');
              props.setAutoConfirmMinConfidence(0.85);
              props.setAutoConfirmAllowedEventTypesText('post_commit\npost_merge');
              props.setAutoConfirmKeywordAllowlistText(
                'migrate\nswitch\nremove\ndeprecate\nrename\nrefactor'
              );
              props.setAutoConfirmKeywordDenylistText('wip\ntmp\ndebug\ntest\ntry');
              props.setAutoExtractionBatchSize(20);
              props.setSearchDefaultMode('hybrid');
              props.setSearchHybridAlpha(0.6);
              props.setSearchHybridBeta(0.4);
              props.setSearchDefaultLimit(20);
              props.setGithubPrefix('github:');
              props.setLocalPrefix('local:');
              props.setAutoCreateProjectSubprojects(true);
              props.setEnableMonorepoResolution(false);
              props.setMonorepoDetectionLevel(2);
              props.setMonorepoMode('repo_hash_subpath');
              props.setMonorepoWorkspaceGlobsText('apps/*\npackages/*');
              props.setMonorepoExcludeGlobsText(
                '**/node_modules/**\n**/.git/**\n**/dist/**\n**/build/**\n.next/**'
              );
              props.setMonorepoRootMarkersText(
                'pnpm-workspace.yaml\nturbo.json\nnx.json\nlerna.json'
              );
              props.setMonorepoMaxDepth(3);
            }}
          >
            Reset Default
          </Button>
        </div>

        <div className="row">
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-switch-repo"
              checked={props.autoSwitchRepo}
              onCheckedChange={(value) => props.setAutoSwitchRepo(value === true)}
            />
            <Label htmlFor="auto-switch-repo" className="text-sm text-muted-foreground">
              auto switch project when repository changes
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="allow-manual-pin"
              checked={props.allowManualPin}
              onCheckedChange={(value) => props.setAllowManualPin(value === true)}
            />
            <Label htmlFor="allow-manual-pin" className="text-sm text-muted-foreground">
              allow manual pin mode (`set_project`)
            </Label>
          </div>
        </div>

        <div className="stack gap-2">
          <Label className="muted">Git Events</Label>
          <div className="row">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-git-events"
                checked={props.enableGitEvents}
                onCheckedChange={(value) => props.setEnableGitEvents(value === true)}
              />
              <Label htmlFor="enable-git-events" className="text-sm text-muted-foreground">
                enable git event capture
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-commit-events"
                checked={props.enableCommitEvents}
                onCheckedChange={(value) => props.setEnableCommitEvents(value === true)}
              />
              <Label htmlFor="enable-commit-events" className="text-sm text-muted-foreground">
                post-commit
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-merge-events"
                checked={props.enableMergeEvents}
                onCheckedChange={(value) => props.setEnableMergeEvents(value === true)}
              />
              <Label htmlFor="enable-merge-events" className="text-sm text-muted-foreground">
                post-merge
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-checkout-events"
                checked={props.enableCheckoutEvents}
                onCheckedChange={(value) => props.setEnableCheckoutEvents(value === true)}
              />
              <Label htmlFor="enable-checkout-events" className="text-sm text-muted-foreground">
                post-checkout (optional)
              </Label>
            </div>
          </div>
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Checkout Debounce Seconds</Label>
              <Input
                type="number"
                min={0}
                max={3600}
                value={props.checkoutDebounceSeconds}
                onChange={(event) =>
                  props.setCheckoutDebounceSeconds(Math.max(Number(event.target.value) || 0, 0))
                }
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Checkout Daily Limit</Label>
              <Input
                type="number"
                min={1}
                max={50000}
                value={props.checkoutDailyLimit}
                onChange={(event) =>
                  props.setCheckoutDailyLimit(Math.max(Number(event.target.value) || 1, 1))
                }
              />
            </div>
          </div>
        </div>

        <div className="stack gap-2">
          <Label className="muted">Decision Auto Extraction</Label>
          <div className="row">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-auto-extraction"
                checked={props.enableAutoExtraction}
                onCheckedChange={(value) => props.setEnableAutoExtraction(value === true)}
              />
              <Label htmlFor="enable-auto-extraction" className="text-sm text-muted-foreground">
                enable raw → decision auto extraction
              </Label>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Mode</Label>
              <Select
                value={props.autoExtractionMode}
                onChange={(event) =>
                  props.setAutoExtractionMode(event.target.value as 'draft_only' | 'auto_confirm')
                }
              >
                <option value="draft_only">draft_only</option>
                <option value="auto_confirm">auto_confirm</option>
              </Select>
            </div>
          </div>
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Auto Confirm Min Confidence</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={props.autoConfirmMinConfidence}
                onChange={(event) =>
                  props.setAutoConfirmMinConfidence(
                    Math.min(Math.max(Number(event.target.value) || 0, 0), 1)
                  )
                }
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Auto Extraction Batch Size</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={props.autoExtractionBatchSize}
                onChange={(event) =>
                  props.setAutoExtractionBatchSize(Math.max(Number(event.target.value) || 1, 1))
                }
              />
            </div>
          </div>
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Allowed Event Types (line-separated)</Label>
              <Textarea
                rows={3}
                value={props.autoConfirmAllowedEventTypesText}
                onChange={(event) => props.setAutoConfirmAllowedEventTypesText(event.target.value)}
                placeholder={'post_commit\npost_merge'}
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Keyword Allowlist (line-separated)</Label>
              <Textarea
                rows={3}
                value={props.autoConfirmKeywordAllowlistText}
                onChange={(event) => props.setAutoConfirmKeywordAllowlistText(event.target.value)}
                placeholder={'migrate\nswitch\nrefactor'}
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Keyword Denylist (line-separated)</Label>
              <Textarea
                rows={3}
                value={props.autoConfirmKeywordDenylistText}
                onChange={(event) => props.setAutoConfirmKeywordDenylistText(event.target.value)}
                placeholder={'wip\ntmp\ndebug'}
              />
            </div>
          </div>
        </div>

        <div className="stack gap-2">
          <Label className="muted">Search Defaults</Label>
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Default Mode</Label>
              <Select
                value={props.searchDefaultMode}
                onChange={(event) =>
                  props.setSearchDefaultMode(event.target.value as 'hybrid' | 'keyword' | 'semantic')
                }
              >
                <option value="hybrid">hybrid</option>
                <option value="keyword">keyword</option>
                <option value="semantic">semantic</option>
              </Select>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Hybrid Alpha (vector)</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={props.searchHybridAlpha}
                onChange={(event) =>
                  props.setSearchHybridAlpha(Math.min(Math.max(Number(event.target.value) || 0, 0), 1))
                }
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Hybrid Beta (fts)</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={props.searchHybridBeta}
                onChange={(event) =>
                  props.setSearchHybridBeta(Math.min(Math.max(Number(event.target.value) || 0, 0), 1))
                }
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Default Limit</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={props.searchDefaultLimit}
                onChange={(event) =>
                  props.setSearchDefaultLimit(Math.max(Number(event.target.value) || 1, 1))
                }
              />
            </div>
          </div>
        </div>

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
      </CardContent>
    </Card>
  );
}
