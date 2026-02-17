'use client';

import type { FormEvent } from 'react';
import type { ProjectMember } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui';

type Props = {
  addProjectMember: (event: FormEvent) => void | Promise<void>;
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  inviteRole: string;
  setInviteRole: (value: string) => void;
  members: ProjectMember[];
};

export function ProjectMembersPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Members</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="row" onSubmit={props.addProjectMember}>
          <Input
            value={props.inviteEmail}
            onChange={(event) => props.setInviteEmail(event.target.value)}
            placeholder="member email"
            required
          />
          <Select value={props.inviteRole} onChange={(event) => props.setInviteRole(event.target.value)}>
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </Select>
          <Button type="submit" className="md:col-span-2">
            Invite Member
          </Button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  {member.user.email}
                  <div className="muted">{member.user.name || 'no name'}</div>
                </TableCell>
                <TableCell>
                  <Badge>{member.role}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
