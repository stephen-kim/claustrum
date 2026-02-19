'use client';

import type { FormEvent } from 'react';
import type { LlmUsageGroupBy, LlmUsageItem } from '../lib/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui';

type Props = {
  selectedWorkspace: string;
  groupBy: LlmUsageGroupBy;
  setGroupBy: (value: LlmUsageGroupBy) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  totals: {
    event_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_cents: number;
  };
  items: LlmUsageItem[];
  loadUsage: (workspaceKey: string, event?: FormEvent) => void | Promise<void>;
};

function formatCost(cents: number): string {
  return `$${(Math.max(cents || 0, 0) / 100).toFixed(4)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.max(Math.round(value || 0), 0));
}

export function LlmUsagePanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>LLM Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="row" onSubmit={(event) => void props.loadUsage(props.selectedWorkspace, event)}>
          <Select
            value={props.groupBy}
            onChange={(event) => props.setGroupBy(event.target.value as LlmUsageGroupBy)}
          >
            <option value="day">Group by day</option>
            <option value="purpose">Group by purpose</option>
            <option value="model">Group by model</option>
          </Select>
          <Input
            type="datetime-local"
            value={props.from}
            onChange={(event) => props.setFrom(event.target.value)}
            placeholder="from"
          />
          <Input
            type="datetime-local"
            value={props.to}
            onChange={(event) => props.setTo(event.target.value)}
            placeholder="to"
          />
          <Button type="submit">Refresh Usage</Button>
        </form>

        <div className="row mt-3">
          <Input readOnly value={`Events: ${formatNumber(props.totals.event_count)}`} />
          <Input readOnly value={`Input tokens: ${formatNumber(props.totals.input_tokens)}`} />
          <Input readOnly value={`Output tokens: ${formatNumber(props.totals.output_tokens)}`} />
          <Input readOnly value={`Estimated cost: ${formatCost(props.totals.estimated_cost_cents)}`} />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Provider/Model</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Input Tokens</TableHead>
              <TableHead>Output Tokens</TableHead>
              <TableHead>Estimated Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.map((item, index) => (
              <TableRow key={`${item.group_key}-${index}`}>
                <TableCell>{item.group_key}</TableCell>
                <TableCell>{item.purpose || '-'}</TableCell>
                <TableCell>{item.provider && item.model ? `${item.provider}/${item.model}` : item.model || '-'}</TableCell>
                <TableCell>{formatNumber(item.event_count)}</TableCell>
                <TableCell>{formatNumber(item.input_tokens)}</TableCell>
                <TableCell>{formatNumber(item.output_tokens)}</TableCell>
                <TableCell>{formatCost(item.estimated_cost_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
