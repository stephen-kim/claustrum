'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminConsolePage } from './components/admin-console-page';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from './components/ui';

const API_BASE_URL = (process.env.NEXT_PUBLIC_MEMORY_CORE_URL || '').trim();
const SESSION_TOKEN_STORAGE_KEY = 'claustrum-admin-session-token';

type MeResponse = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    must_change_password: boolean;
    email_verified: boolean;
    context_persona: 'neutral' | 'author' | 'reviewer' | 'architect';
    auth_method: 'session' | 'api_key' | 'env_admin';
    active_api_key_count: number;
    needs_welcome_setup: boolean;
  };
};

type LoginResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    must_change_password: boolean;
    email_verified: boolean;
  };
};

function resolveDeviceLabel(prefix: string): string {
  if (typeof window === 'undefined') {
    return `${prefix}-unknown`;
  }
  const platform = (navigator.platform || 'browser').replace(/\s+/g, '-');
  const host = (window.location.hostname || 'localhost').replace(/\s+/g, '-');
  return `${prefix}-${platform}-${host}`.slice(0, 120);
}

export default function Page() {
  const [token, setToken] = useState('');
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');

  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupName, setSetupName] = useState('');
  const [welcomeWorkspaceKey, setWelcomeWorkspaceKey] = useState('');
  const [generatedWelcomeApiKey, setGeneratedWelcomeApiKey] = useState('');
  const [welcomeApiKeyLabel, setWelcomeApiKeyLabel] = useState('onboarding-default');
  const [gitCaptureReported, setGitCaptureReported] = useState(false);

  const missingCoreUrl = !API_BASE_URL;

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || '';
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
  }, []);

  useEffect(() => {
    if (!token || missingCoreUrl) {
      setLoading(false);
      setMe(null);
      return;
    }
    void refreshMe(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, missingCoreUrl]);

  useEffect(() => {
    if (!token || !me || me.must_change_password || missingCoreUrl) {
      return;
    }
    if (welcomeWorkspaceKey) {
      return;
    }
    void loadFirstWorkspaceKey(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, me, missingCoreUrl, welcomeWorkspaceKey]);

  const showSetup = useMemo(() => Boolean(me?.must_change_password), [me?.must_change_password]);
  const showWelcomeSetup = useMemo(
    () => Boolean(me && !me.must_change_password && me.needs_welcome_setup),
    [me]
  );
  const gitInstallCommand = useMemo(() => {
    const workspaceKey = welcomeWorkspaceKey || '<workspace-key>';
    const apiKeyValue = generatedWelcomeApiKey || '<your-api-key>';
    return [
      `MEMORY_CORE_URL=${API_BASE_URL}`,
      `MEMORY_CORE_API_KEY=${apiKeyValue}`,
      `MEMORY_CORE_WORKSPACE_KEY=${workspaceKey}`,
      'pnpm --filter @claustrum/mcp-adapter start -- install-hooks --workspace-key',
      workspaceKey,
    ].join(' ');
  }, [welcomeWorkspaceKey, generatedWelcomeApiKey]);

  async function callAuthApi<T>(path: string, init?: RequestInit, useToken = false): Promise<T> {
    if (missingCoreUrl) {
      throw new Error(
        'NEXT_PUBLIC_MEMORY_CORE_URL is not set. Configure a browser-reachable memory-core URL.'
      );
    }
    const headers = new Headers(init?.headers || {});
    headers.set('content-type', 'application/json');
    if (useToken && token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  async function refreshMe(currentToken: string) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
        headers: {
          authorization: `Bearer ${currentToken}`,
        },
      });
      if (!response.ok) {
        throw new Error('Session expired');
      }
      const data = (await response.json()) as MeResponse;
      setMe(data.user);
      setSetupEmail(data.user.email === 'admin@example.com' ? '' : data.user.email);
      setSetupName(data.user.name || '');
    } catch (refreshError) {
      window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      setToken('');
      setMe(null);
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setLoading(false);
    }
  }

  async function loadFirstWorkspaceKey(currentToken: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/workspaces`, {
        headers: {
          authorization: `Bearer ${currentToken}`,
        },
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { workspaces?: Array<{ key: string }> };
      const firstKey = data.workspaces?.[0]?.key || '';
      setWelcomeWorkspaceKey(firstKey);
    } catch {
      // best effort
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await callAuthApi<LoginResponse>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, result.token);
      setToken(result.token);
      await refreshMe(result.token);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : String(loginError));
    } finally {
      setBusy(false);
    }
  }

  async function completeSetup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await callAuthApi(
        '/v1/auth/complete-setup',
        {
          method: 'POST',
          body: JSON.stringify({
            new_email: setupEmail.trim(),
            new_password: setupPassword,
            name: setupName.trim() || undefined,
          }),
        },
        true
      );
      await refreshMe(token);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : String(setupError));
    } finally {
      setBusy(false);
    }
  }

  async function generateWelcomeApiKey() {
    setBusy(true);
    setError('');
    try {
      const result = await callAuthApi<{ id: string; label: string | null; api_key: string }>(
        '/v1/api-keys',
        {
          method: 'POST',
          body: JSON.stringify({
            label: welcomeApiKeyLabel.trim() || 'onboarding-default',
            device_label: resolveDeviceLabel('welcome-setup'),
          }),
        },
        true
      );
      setGeneratedWelcomeApiKey(result.api_key);
      await refreshMe(token);
    } catch (apiKeyError) {
      setError(apiKeyError instanceof Error ? apiKeyError.message : String(apiKeyError));
    } finally {
      setBusy(false);
    }
  }

  async function reportGitCaptureInstalled() {
    if (!welcomeWorkspaceKey) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await callAuthApi(
        '/v1/onboarding/git-capture-installed',
        {
          method: 'POST',
          body: JSON.stringify({
            workspace_key: welcomeWorkspaceKey,
            metadata: {
              source: 'welcome_setup',
            },
          }),
        },
        true
      );
      setGitCaptureReported(true);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : String(reportError));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await callAuthApi('/v1/auth/logout', { method: 'POST', body: '{}' }, true);
    } catch {
      // best effort logout
    } finally {
      window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem('memory-core-admin-key');
      setToken('');
      setMe(null);
      setPassword('');
      setSetupPassword('');
      setGeneratedWelcomeApiKey('');
      setGitCaptureReported(false);
    }
  }

  if (missingCoreUrl) {
    return (
      <main className="dashboard">
        <section className="content">
          <Card>
            <CardHeader>
              <CardTitle>Admin UI Configuration Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="error">
                NEXT_PUBLIC_MEMORY_CORE_URL is missing. Set it to a browser-reachable memory-core URL.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="dashboard">
        <section className="content">
          <Card>
            <CardHeader>
              <CardTitle>Loading session...</CardTitle>
            </CardHeader>
          </Card>
        </section>
      </main>
    );
  }

  if (!token || !me) {
    return (
      <main className="dashboard">
        <section className="content">
          <Card>
            <CardHeader>
              <CardTitle>Admin Login</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="stack" onSubmit={login}>
                <div className="stack gap-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="stack gap-1">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Signing in...' : 'Sign In'}
                </Button>
                {error ? <p className="error">{error}</p> : null}
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  if (showSetup) {
    return (
      <main className="dashboard">
        <section className="content">
          <Card>
            <CardHeader>
              <CardTitle>Complete Initial Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="muted">
                Initial admin credentials are temporary. Please set your real email and a new password.
              </p>
              <form className="stack" onSubmit={completeSetup}>
                <div className="stack gap-1">
                  <Label>New Email</Label>
                  <Input
                    type="email"
                    value={setupEmail}
                    onChange={(event) => setSetupEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="stack gap-1">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={setupPassword}
                    onChange={(event) => setSetupPassword(event.target.value)}
                    minLength={12}
                    required
                  />
                </div>
                <div className="stack gap-1">
                  <Label>Name (optional)</Label>
                  <Input value={setupName} onChange={(event) => setSetupName(event.target.value)} />
                </div>
                <div className="toolbar">
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Saving...' : 'Complete Setup'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void logout()}>
                    Logout
                  </Button>
                </div>
                {error ? <p className="error">{error}</p> : null}
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  if (showWelcomeSetup) {
    return (
      <main className="dashboard">
        <section className="content">
          <Card>
            <CardHeader>
              <CardTitle>Welcome Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="stack gap-3">
                <p className="muted">
                  Complete the quick onboarding steps to start using Claustrum with your team workspace.
                </p>

                <div className="stack gap-2 rounded-md border border-border p-3">
                  <h3 className="text-sm font-semibold">Step 1. Generate your API Key</h3>
                  <div className="row">
                    <Input
                      value={welcomeApiKeyLabel}
                      onChange={(event) => setWelcomeApiKeyLabel(event.target.value)}
                      placeholder="API key label"
                    />
                    <Button type="button" className="md:col-span-2" onClick={() => void generateWelcomeApiKey()} disabled={busy}>
                      Generate API Key
                    </Button>
                  </div>
                  {generatedWelcomeApiKey ? (
                    <div className="stack gap-2">
                      <p className="muted text-xs">Shown once. Copy and store securely.</p>
                      <Input value={generatedWelcomeApiKey} readOnly />
                      <div className="toolbar">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void navigator.clipboard.writeText(generatedWelcomeApiKey)}
                        >
                          Copy API Key
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="stack gap-2 rounded-md border border-border p-3">
                  <h3 className="text-sm font-semibold">Step 2. Enable Git Auto Capture (Optional)</h3>
                  <p className="muted text-xs">Runs locally on your machine.</p>
                  <p className="muted text-xs">Does not modify your repository.</p>
                  <Input value={gitInstallCommand} readOnly />
                  <div className="toolbar">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void navigator.clipboard.writeText(gitInstallCommand)}
                    >
                      Copy Install Command
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void reportGitCaptureInstalled()} disabled={busy || !welcomeWorkspaceKey}>
                      {gitCaptureReported ? 'Marked Installed' : 'Mark as Installed'}
                    </Button>
                  </div>
                </div>

                <div className="toolbar">
                  <Button type="button" variant="ghost" onClick={() => void refreshMe(token)} disabled={busy}>
                    Refresh Status
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void logout()}>
                    Logout
                  </Button>
                </div>

                {error ? <p className="error">{error}</p> : null}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return <AdminConsolePage logout={logout} />;
}
