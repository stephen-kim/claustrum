'use client';

import type { FormEvent } from 'react';
import type { AuditLogItem } from '../lib/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui';

type Props = {
  auditActionPrefix: string;
  setAuditActionPrefix: (value: string) => void;
  auditLimit: number;
  setAuditLimit: (value: number) => void;
  selectedWorkspace: string;
  loadAuditLogs: (workspaceKey: string) => Promise<void>;
  auditLogs: AuditLogItem[];
};

export function AuditLogsPanel(props: Props) {
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!props.selectedWorkspace) {
      return;
    }
    void props.loadAuditLogs(props.selectedWorkspace);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="row" onSubmit={onSubmit}>
          <Input
            value={props.auditActionPrefix}
            onChange={(event) => props.setAuditActionPrefix(event.target.value)}
            placeholder="action prefix (e.g. ci.)"
          />
          <Input
            type="number"
            min={1}
            max={200}
            value={props.auditLimit}
            onChange={(event) => props.setAuditLimit(Number(event.target.value))}
          />
          <Button type="submit" className="md:col-span-2">
            Refresh Audit
          </Button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.auditLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>{log.actorUserId}</TableCell>
                <TableCell>
                  <pre>{JSON.stringify(log.target, null, 2)}</pre>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
