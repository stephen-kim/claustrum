'use client';

import type { FormEvent } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Select,
  Textarea,
} from './ui';

type Props = {
  submitCiEvent: (event: FormEvent) => void | Promise<void>;
  ciStatus: 'success' | 'failure';
  setCiStatus: (value: 'success' | 'failure') => void;
  ciProvider: 'github_actions' | 'generic';
  setCiProvider: (value: 'github_actions' | 'generic') => void;
  ciUseSelectedProject: boolean;
  setCiUseSelectedProject: (value: boolean) => void;
  ciWorkflowName: string;
  setCiWorkflowName: (value: string) => void;
  ciWorkflowRunId: string;
  setCiWorkflowRunId: (value: string) => void;
  ciWorkflowRunUrl: string;
  setCiWorkflowRunUrl: (value: string) => void;
  ciRepository: string;
  setCiRepository: (value: string) => void;
  ciBranch: string;
  setCiBranch: (value: string) => void;
  ciSha: string;
  setCiSha: (value: string) => void;
  ciEventName: string;
  setCiEventName: (value: string) => void;
  ciJobName: string;
  setCiJobName: (value: string) => void;
  ciMessage: string;
  setCiMessage: (value: string) => void;
  ciMetadata: string;
  setCiMetadata: (value: string) => void;
};

export function CiEventsPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CI Events (GitHub Actions)</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="stack" onSubmit={props.submitCiEvent}>
          <div className="row">
            <Select
              value={props.ciStatus}
              onChange={(event) => props.setCiStatus(event.target.value as 'success' | 'failure')}
            >
              <option value="failure">failure</option>
              <option value="success">success</option>
            </Select>
            <Select
              value={props.ciProvider}
              onChange={(event) =>
                props.setCiProvider(event.target.value as 'github_actions' | 'generic')
              }
            >
              <option value="github_actions">github_actions</option>
              <option value="generic">generic</option>
            </Select>
          </div>

          <div className="row">
            <Input
              value={props.ciWorkflowName}
              onChange={(event) => props.setCiWorkflowName(event.target.value)}
              placeholder="workflow name (e.g. CI)"
            />
            <Input
              value={props.ciWorkflowRunId}
              onChange={(event) => props.setCiWorkflowRunId(event.target.value)}
              placeholder="workflow run id"
            />
          </div>

          <Input
            value={props.ciWorkflowRunUrl}
            onChange={(event) => props.setCiWorkflowRunUrl(event.target.value)}
            placeholder="workflow run url"
          />

          <div className="row">
            <Input
              value={props.ciRepository}
              onChange={(event) => props.setCiRepository(event.target.value)}
              placeholder="repository (e.g. owner/repo)"
            />
            <Input
              value={props.ciBranch}
              onChange={(event) => props.setCiBranch(event.target.value)}
              placeholder="branch"
            />
          </div>

          <div className="row">
            <Input
              value={props.ciSha}
              onChange={(event) => props.setCiSha(event.target.value)}
              placeholder="commit sha"
            />
            <Input
              value={props.ciEventName}
              onChange={(event) => props.setCiEventName(event.target.value)}
              placeholder="event name (push/pull_request)"
            />
          </div>

          <Input
            value={props.ciJobName}
            onChange={(event) => props.setCiJobName(event.target.value)}
            placeholder="job name"
          />

          <Textarea
            value={props.ciMessage}
            onChange={(event) => props.setCiMessage(event.target.value)}
            placeholder="short summary/message"
          />

          <Textarea
            value={props.ciMetadata}
            onChange={(event) => props.setCiMetadata(event.target.value)}
            placeholder='metadata JSON (e.g. {"source":"admin-ui"})'
          />

          <div className="flex items-center gap-2">
            <Checkbox
              id="ci-event-selected-project"
              checked={props.ciUseSelectedProject}
              onCheckedChange={(value) => props.setCiUseSelectedProject(value === true)}
            />
            <label htmlFor="ci-event-selected-project" className="text-sm text-muted-foreground">
              include selected project key
            </label>
          </div>

          <div className="toolbar">
            <Button type="submit">Send CI Event</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
