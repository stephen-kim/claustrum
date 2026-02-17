'use client';

import type { FormEvent } from 'react';
import type { RawMessageDetail, RawSearchMatch } from '../lib/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui';

type Props = {
  runRawSearch: (event: FormEvent) => void | Promise<void>;
  rawQuery: string;
  setRawQuery: (value: string) => void;
  rawLimit: number;
  setRawLimit: (value: number) => void;
  rawUseSelectedProject: boolean;
  setRawUseSelectedProject: (value: boolean) => void;
  rawMatches: RawSearchMatch[];
  viewRawMessage: (id: string) => Promise<void>;
  rawMessageDetail: RawMessageDetail | null;
};

export function RawSearchPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Raw Search (Snippet Only)</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="stack" onSubmit={props.runRawSearch}>
          <div className="row">
            <Input
              value={props.rawQuery}
              onChange={(event) => props.setRawQuery(event.target.value)}
              placeholder="query text"
              required
            />
            <Input
              type="number"
              min={1}
              max={20}
              value={props.rawLimit}
              onChange={(event) => props.setRawLimit(Number(event.target.value))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="raw-search-selected-project"
              checked={props.rawUseSelectedProject}
              onCheckedChange={(value) => props.setRawUseSelectedProject(value === true)}
            />
            <label htmlFor="raw-search-selected-project" className="text-sm text-muted-foreground">
              scope raw search to selected project
            </label>
          </div>
          <div className="toolbar">
            <Button type="submit">Search Raw Snippets</Button>
          </div>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Snippet</TableHead>
              <TableHead>View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rawMatches.map((match) => (
              <TableRow key={match.message_id}>
                <TableCell>{new Date(match.created_at).toLocaleString()}</TableCell>
                <TableCell>{match.role}</TableCell>
                <TableCell>{match.project_key || '-'}</TableCell>
                <TableCell>{match.snippet}</TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void props.viewRawMessage(match.message_id)}>
                    open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Raw Message Detail</h3>
        {props.rawMessageDetail ? (
          <pre>{JSON.stringify(props.rawMessageDetail, null, 2)}</pre>
        ) : (
          <div className="muted">Select a raw search row and open message to view audited snippet.</div>
        )}
      </CardContent>
    </Card>
  );
}
