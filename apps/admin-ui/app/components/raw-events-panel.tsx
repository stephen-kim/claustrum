'use client';

import type { FormEvent } from 'react';
import type { Project, RawEventItem, RawEventType } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui';

type Props = {
  selectedWorkspace: string;
  projects: Project[];
  rawEventProjectFilter: string;
  setRawEventProjectFilter: (value: string) => void;
  rawEventTypeFilter: '' | RawEventType;
  setRawEventTypeFilter: (value: '' | RawEventType) => void;
  rawEventCommitShaFilter: string;
  setRawEventCommitShaFilter: (value: string) => void;
  rawEventFrom: string;
  setRawEventFrom: (value: string) => void;
  rawEventTo: string;
  setRawEventTo: (value: string) => void;
  rawEventLimit: number;
  setRawEventLimit: (value: number) => void;
  rawEvents: RawEventItem[];
  loadRawEvents: (event?: FormEvent) => Promise<void>;
};

export function RawEventsPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Raw Events</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="toolbar" onSubmit={(event) => void props.loadRawEvents(event)}>
          <div className="stack gap-1">
            <Label className="muted">Project</Label>
            <Select
              value={props.rawEventProjectFilter}
              onChange={(event) => props.setRawEventProjectFilter(event.target.value)}
            >
              <option value="">(all, admin only)</option>
              {props.projects.map((project) => (
                <option key={project.id} value={project.key}>
                  {project.key}
                </option>
              ))}
            </Select>
          </div>
          <div className="stack gap-1">
            <Label className="muted">Event Type</Label>
            <Select
              value={props.rawEventTypeFilter}
              onChange={(event) =>
                props.setRawEventTypeFilter((event.target.value as RawEventType | '') || '')
              }
            >
              <option value="">all</option>
              <option value="post_commit">post_commit</option>
              <option value="post_merge">post_merge</option>
              <option value="post_checkout">post_checkout</option>
            </Select>
          </div>
          <div className="stack gap-1">
            <Label className="muted">Commit SHA</Label>
            <Input
              value={props.rawEventCommitShaFilter}
              onChange={(event) => props.setRawEventCommitShaFilter(event.target.value)}
              placeholder="sha contains..."
            />
          </div>
          <div className="stack gap-1">
            <Label className="muted">From</Label>
            <Input
              type="datetime-local"
              value={props.rawEventFrom}
              onChange={(event) => props.setRawEventFrom(event.target.value)}
            />
          </div>
          <div className="stack gap-1">
            <Label className="muted">To</Label>
            <Input
              type="datetime-local"
              value={props.rawEventTo}
              onChange={(event) => props.setRawEventTo(event.target.value)}
            />
          </div>
          <div className="stack gap-1">
            <Label className="muted">Limit</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={props.rawEventLimit}
              onChange={(event) => props.setRawEventLimit(Math.max(Number(event.target.value) || 1, 1))}
            />
          </div>
          <Button type="submit" disabled={!props.selectedWorkspace}>
            Load Raw Events
          </Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rawEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge>{event.event_type}</Badge>
                </TableCell>
                <TableCell>{event.project_key}</TableCell>
                <TableCell>{event.branch || event.to_branch || '-'}</TableCell>
                <TableCell>{event.commit_sha || '-'}</TableCell>
                <TableCell>{event.commit_message || '-'}</TableCell>
              </TableRow>
            ))}
            {props.rawEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="muted">
                  No raw events
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
