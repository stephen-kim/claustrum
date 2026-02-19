'use client';

import type { ProjectRole, ResolutionKind } from '../lib/types';
import { kindDescription, reorderKinds } from '../lib/utils';
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
import { applyResolutionDefaults } from './resolution-settings-defaults';
import { ResolutionSettingsMonorepoSection } from './resolution-settings-monorepo-section';
import type { Props } from './resolution-settings-types';

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
          <Button type="button" variant="secondary" onClick={() => applyResolutionDefaults(props)}>
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
          <Label className="muted">Extraction Pipeline</Label>
          <div className="row">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-activity-auto-log"
                checked={props.enableActivityAutoLog}
                onCheckedChange={(value) => props.setEnableActivityAutoLog(value === true)}
              />
              <Label htmlFor="enable-activity-auto-log" className="text-sm text-muted-foreground">
                create activity memory for every commit/merge
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-decision-extraction"
                checked={props.enableDecisionExtraction}
                onCheckedChange={(value) => props.setEnableDecisionExtraction(value === true)}
              />
              <Label htmlFor="enable-decision-extraction" className="text-sm text-muted-foreground">
                run LLM decision extraction jobs
              </Label>
            </div>
          </div>
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Decision Extraction Mode</Label>
              <Select
                value={props.decisionExtractionMode}
                onChange={(event) =>
                  props.setDecisionExtractionMode(event.target.value as 'llm_only' | 'hybrid_priority')
                }
              >
                <option value="llm_only">llm_only</option>
                <option value="hybrid_priority">hybrid_priority</option>
              </Select>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Default Decision Status</Label>
              <Select
                value={props.decisionDefaultStatus}
                onChange={(event) =>
                  props.setDecisionDefaultStatus(event.target.value as 'draft' | 'confirmed')
                }
              >
                <option value="draft">draft</option>
                <option value="confirmed">confirmed</option>
              </Select>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Decision Batch Size</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={props.decisionBatchSize}
                onChange={(event) => props.setDecisionBatchSize(Math.max(Number(event.target.value) || 1, 1))}
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Decision Backfill Days</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={props.decisionBackfillDays}
                onChange={(event) =>
                  props.setDecisionBackfillDays(Math.max(Number(event.target.value) || 1, 1))
                }
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Raw Access Minimum Role</Label>
              <Select
                value={props.rawAccessMinRole}
                onChange={(event) => props.setRawAccessMinRole(event.target.value as ProjectRole)}
              >
                <option value="OWNER">OWNER</option>
                <option value="MAINTAINER">MAINTAINER</option>
                <option value="WRITER">WRITER</option>
                <option value="READER">READER</option>
              </Select>
              <div className="muted">default: WRITER</div>
            </div>
          </div>
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Active Work Stale Days</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={props.activeWorkStaleDays}
                onChange={(event) =>
                  props.setActiveWorkStaleDays(Math.min(Math.max(Number(event.target.value) || 1, 1), 3650))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="active-work-auto-close-enabled"
                checked={props.activeWorkAutoCloseEnabled}
                onCheckedChange={(value) => props.setActiveWorkAutoCloseEnabled(value === true)}
              />
              <Label htmlFor="active-work-auto-close-enabled" className="text-sm text-muted-foreground">
                enable active work auto-close
              </Label>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Active Work Auto-close Days</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={props.activeWorkAutoCloseDays}
                onChange={(event) =>
                  props.setActiveWorkAutoCloseDays(Math.min(Math.max(Number(event.target.value) || 1, 1), 3650))
                }
              />
            </div>
          </div>
          <div className="row">
            <div className="flex items-center gap-2">
              <Checkbox
                id="decision-auto-confirm-enabled"
                checked={props.decisionAutoConfirmEnabled}
                onCheckedChange={(value) => props.setDecisionAutoConfirmEnabled(value === true)}
              />
              <Label
                htmlFor="decision-auto-confirm-enabled"
                className="text-sm text-muted-foreground"
              >
                auto-confirm when confidence threshold is met
              </Label>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Auto Confirm Min Confidence</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={props.decisionAutoConfirmMinConfidence}
                onChange={(event) =>
                  props.setDecisionAutoConfirmMinConfidence(
                    Math.min(Math.max(Number(event.target.value) || 0, 0), 1)
                  )
                }
              />
            </div>
          </div>
          <div className="muted">
            Keywords do NOT decide decisions. They only prioritize LLM processing.
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
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Recency Half-life (days)</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                step={1}
                value={props.searchRecencyHalfLifeDays}
                onChange={(event) =>
                  props.setSearchRecencyHalfLifeDays(
                    Math.min(Math.max(Number(event.target.value) || 1, 1), 3650)
                  )
                }
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Search Subpath Boost Weight</Label>
              <Input
                type="number"
                min={1}
                max={10}
                step={0.1}
                value={props.searchSubpathBoostWeight}
                onChange={(event) =>
                  props.setSearchSubpathBoostWeight(
                    Math.min(Math.max(Number(event.target.value) || 1.5, 1), 10)
                  )
                }
              />
            </div>
          </div>
          <div className="stack gap-1">
            <Label className="muted">Type Weights (JSON)</Label>
            <Textarea
              value={props.searchTypeWeightsJson}
              onChange={(event) => props.setSearchTypeWeightsJson(event.target.value)}
              rows={7}
              placeholder='{"decision":1.5,"constraint":1.35,"goal":1.2}'
            />
            <div className="muted">Used for hybrid ranking (decision &gt; constraint &gt; goal by default).</div>
          </div>
        </div>

        <div className="stack gap-2">
          <Label className="muted">Audit Retention Policy</Label>
          <div className="row">
            <div className="flex items-center gap-2">
              <Checkbox
                id="retention-policy-enabled"
                checked={props.retentionPolicyEnabled}
                onCheckedChange={(value) => props.setRetentionPolicyEnabled(value === true)}
              />
              <Label htmlFor="retention-policy-enabled" className="text-sm text-muted-foreground">
                enable retention policy (daily background job)
              </Label>
            </div>
          </div>
          <div className="row">
            <div className="stack gap-1">
              <Label className="muted">Audit Retention Days</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={props.auditRetentionDays}
                onChange={(event) =>
                  props.setAuditRetentionDays(Math.max(Number(event.target.value) || 1, 1))
                }
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Raw Retention Days</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={props.rawRetentionDays}
                onChange={(event) =>
                  props.setRawRetentionDays(Math.max(Number(event.target.value) || 1, 1))
                }
              />
            </div>
            <div className="stack gap-1">
              <Label className="muted">Retention Mode</Label>
              <Select
                value={props.retentionMode}
                onChange={(event) =>
                  props.setRetentionMode(event.target.value as 'archive' | 'hard_delete')
                }
              >
                <option value="archive">archive (default, recommended)</option>
                <option value="hard_delete">hard_delete</option>
              </Select>
            </div>
          </div>
        </div>

        <ResolutionSettingsMonorepoSection props={props} />
      </CardContent>
    </Card>
  );
}
