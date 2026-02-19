
'use client';

import type { IntegrationsPanelProps } from './types';
import { Button, Input, Label, Select, Textarea } from '../ui';

type SectionProps = {
  props: IntegrationsPanelProps;
  handleCreateAuditSink: () => void;
  handleRefreshAuditDeliveries: () => void;
  handleCreateDetectionRule: () => void;
};

export function SiemDetectionsSection({
  props,
  handleCreateAuditSink,
  handleRefreshAuditDeliveries,
  handleCreateDetectionRule,
}: SectionProps) {
  return (
    <>
<hr className="border-border/60" />
            <strong>SIEM: Audit Sinks + Security Stream</strong>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.securityStreamEnabled}
                onChange={(event) => props.setSecurityStreamEnabled(event.target.checked)}
              />{' '}
              Enable security stream
            </label>
            <div className="row">
              <label className="stack gap-1">
                <Label className="muted">Security stream sink</Label>
                <Select
                  value={props.securityStreamSinkId}
                  onChange={(event) => props.setSecurityStreamSinkId(event.target.value)}
                >
                  <option value="">Auto (all security-capable sinks)</option>
                  {props.auditSinks.map((sink) => (
                    <option key={sink.id} value={sink.id}>
                      {sink.name} ({sink.type})
                    </option>
                  ))}
                </Select>
              </label>
              <label className="stack gap-1">
                <Label className="muted">Min severity</Label>
                <Select
                  value={props.securityStreamMinSeverity}
                  onChange={(event) =>
                    props.setSecurityStreamMinSeverity(
                      event.target.value as 'low' | 'medium' | 'high'
                    )
                  }
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </Select>
              </label>
              <Button
                type="button"
                onClick={() => {
                  void props.saveGithubProjectSettings();
                }}
              >
                Save security stream settings
              </Button>
            </div>
            <div className="muted">
              Security taxonomy: auth.*, access.*, api_key.*, raw.search/raw.view, audit.export, oidc.*
            </div>

            <div className="stack">
              <strong>Create audit sink</strong>
              <div className="row">
                <Select
                  value={props.newAuditSinkType}
                  onChange={(event) => props.setNewAuditSinkType(event.target.value as 'webhook' | 'http')}
                >
                  <option value="webhook">webhook</option>
                  <option value="http">http</option>
                </Select>
                <Input
                  value={props.newAuditSinkName}
                  onChange={(event) => props.setNewAuditSinkName(event.target.value)}
                  placeholder="sink name"
                />
                <Input
                  value={props.newAuditSinkEndpointUrl}
                  onChange={(event) => props.setNewAuditSinkEndpointUrl(event.target.value)}
                  placeholder="https://siem.example.com/ingest"
                />
                <Input
                  value={props.newAuditSinkSecret}
                  onChange={(event) => props.setNewAuditSinkSecret(event.target.value)}
                  placeholder="HMAC secret"
                  type="password"
                />
                <label className="muted">
                  <Input
                    type="checkbox"
                    checked={props.newAuditSinkEnabled}
                    onChange={(event) => props.setNewAuditSinkEnabled(event.target.checked)}
                  />{' '}
                  enabled
                </label>
              </div>
              <div className="row">
                <label className="stack gap-1" style={{ flex: 1 }}>
                  <Label className="muted">event_filter JSON</Label>
                  <Textarea
                    value={props.newAuditSinkEventFilterJson}
                    onChange={(event) => props.setNewAuditSinkEventFilterJson(event.target.value)}
                    rows={5}
                  />
                </label>
                <label className="stack gap-1" style={{ flex: 1 }}>
                  <Label className="muted">retry_policy JSON</Label>
                  <Textarea
                    value={props.newAuditSinkRetryPolicyJson}
                    onChange={(event) => props.setNewAuditSinkRetryPolicyJson(event.target.value)}
                    rows={5}
                  />
                </label>
              </div>
              <label className="stack gap-1">
                <Label className="muted">Reason (for audit log)</Label>
                <Input
                  value={props.auditSinkReason}
                  onChange={(event) => props.setAuditSinkReason(event.target.value)}
                  placeholder="optional"
                />
              </label>
              <div className="toolbar">
                <Button
                  type="button"
                  onClick={() => {
                    void handleCreateAuditSink();
                  }}
                >
                  Create sink
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void handleRefreshAuditDeliveries();
                  }}
                >
                  Refresh deliveries
                </Button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Endpoint</th>
                      <th>Enabled</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.auditSinks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          no audit sinks
                        </td>
                      </tr>
                    ) : (
                      props.auditSinks.map((sink) => (
                        <tr key={sink.id}>
                          <td>{sink.name}</td>
                          <td>{sink.type}</td>
                          <td>{sink.endpoint_url}</td>
                          <td>{sink.enabled ? 'yes' : 'no'}</td>
                          <td>
                            <div className="toolbar">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  void props.patchAuditSink({
                                    sinkId: sink.id,
                                    input: { enabled: !sink.enabled, reason: props.auditSinkReason || undefined },
                                  });
                                }}
                              >
                                Toggle
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  void props.testAuditSink(sink.id);
                                }}
                              >
                                Test
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  void props.deleteAuditSink(sink.id);
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
              <div className="row">
                <label className="stack gap-1">
                  <Label className="muted">Delivery status filter</Label>
                  <Select
                    value={props.auditDeliveryStatusFilter}
                    onChange={(event) =>
                      props.setAuditDeliveryStatusFilter(
                        event.target.value as 'queued' | 'sending' | 'delivered' | 'failed' | ''
                      )
                    }
                  >
                    <option value="">all</option>
                    <option value="queued">queued</option>
                    <option value="sending">sending</option>
                    <option value="delivered">delivered</option>
                    <option value="failed">failed</option>
                  </Select>
                </label>
                <Button
                  type="button"
                  onClick={() => {
                    void handleRefreshAuditDeliveries();
                  }}
                >
                  Apply filter
                </Button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Updated</th>
                      <th>Sink</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th>Attempt</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.auditDeliveries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          no delivery rows
                        </td>
                      </tr>
                    ) : (
                      props.auditDeliveries.slice(0, 30).map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.updated_at).toLocaleString()}</td>
                          <td>{row.sink_name}</td>
                          <td>{row.action_key}</td>
                          <td>{row.status}</td>
                          <td>{row.attempt_count}</td>
                          <td>{row.last_error || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <hr className="border-border/60" />
            <strong>Detections</strong>
            <div className="muted">
              Keywords and thresholds prioritize/trigger monitoring. Decisions are still determined by LLM pipeline.
            </div>
            <div className="stack">
              <div className="row">
                <Input
                  value={props.newDetectionRuleName}
                  onChange={(event) => props.setNewDetectionRuleName(event.target.value)}
                  placeholder="rule name"
                />
                <Select
                  value={props.newDetectionRuleSeverity}
                  onChange={(event) =>
                    props.setNewDetectionRuleSeverity(event.target.value as 'low' | 'medium' | 'high')
                  }
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </Select>
                <label className="muted">
                  <Input
                    type="checkbox"
                    checked={props.newDetectionRuleEnabled}
                    onChange={(event) => props.setNewDetectionRuleEnabled(event.target.checked)}
                  />{' '}
                  enabled
                </label>
              </div>
              <div className="row">
                <label className="stack gap-1" style={{ flex: 1 }}>
                  <Label className="muted">condition JSON</Label>
                  <Textarea
                    value={props.newDetectionRuleConditionJson}
                    onChange={(event) => props.setNewDetectionRuleConditionJson(event.target.value)}
                    rows={5}
                  />
                </label>
                <label className="stack gap-1" style={{ flex: 1 }}>
                  <Label className="muted">notify JSON</Label>
                  <Textarea
                    value={props.newDetectionRuleNotifyJson}
                    onChange={(event) => props.setNewDetectionRuleNotifyJson(event.target.value)}
                    rows={5}
                  />
                </label>
              </div>
              <label className="stack gap-1">
                <Label className="muted">Reason (for audit log)</Label>
                <Input
                  value={props.detectionRuleReason}
                  onChange={(event) => props.setDetectionRuleReason(event.target.value)}
                  placeholder="optional"
                />
              </label>
              <div className="toolbar">
                <Button
                  type="button"
                  onClick={() => {
                    void handleCreateDetectionRule();
                  }}
                >
                  Create rule
                </Button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Severity</th>
                      <th>Enabled</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.detectionRules.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="muted">
                          no detection rules
                        </td>
                      </tr>
                    ) : (
                      props.detectionRules.map((rule) => (
                        <tr key={rule.id}>
                          <td>{rule.name}</td>
                          <td>{rule.severity}</td>
                          <td>{rule.enabled ? 'yes' : 'no'}</td>
                          <td>
                            <div className="toolbar">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  void props.patchDetectionRule({
                                    ruleId: rule.id,
                                    input: { enabled: !rule.enabled, reason: props.detectionRuleReason || undefined },
                                  });
                                }}
                              >
                                Toggle
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  void props.deleteDetectionRule(rule.id);
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
              <div className="row">
                <label className="stack gap-1">
                  <Label className="muted">Detection status filter</Label>
                  <Select
                    value={props.detectionStatusFilter}
                    onChange={(event) =>
                      props.setDetectionStatusFilter(
                        event.target.value as 'open' | 'ack' | 'closed' | ''
                      )
                    }
                  >
                    <option value="">all</option>
                    <option value="open">open</option>
                    <option value="ack">ack</option>
                    <option value="closed">closed</option>
                  </Select>
                </label>
                <Button
                  type="button"
                  onClick={() => {
                    if (props.selectedWorkspace) {
                      void props.loadDetections(props.selectedWorkspace);
                    }
                  }}
                >
                  Refresh detections
                </Button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Triggered</th>
                      <th>Rule</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Actor</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.detections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          no detections
                        </td>
                      </tr>
                    ) : (
                      props.detections.slice(0, 30).map((detection) => (
                        <tr key={detection.id}>
                          <td>{new Date(detection.triggered_at).toLocaleString()}</td>
                          <td>{detection.rule_name}</td>
                          <td>{detection.severity}</td>
                          <td>{detection.status}</td>
                          <td>{detection.actor_user_id || '-'}</td>
                          <td>
                            <div className="toolbar">
                              {detection.status !== 'ack' ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    void props.updateDetectionStatus(detection.id, 'ack');
                                  }}
                                >
                                  Ack
                                </Button>
                              ) : null}
                              {detection.status !== 'closed' ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    void props.updateDetectionStatus(detection.id, 'closed');
                                  }}
                                >
                                  Close
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            
    </>
  );
}
