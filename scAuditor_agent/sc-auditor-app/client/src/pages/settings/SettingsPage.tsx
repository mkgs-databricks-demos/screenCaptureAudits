import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Input, Select } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/ThemeProvider';
import {
  listCredentials,
  createCredential,
  deleteCredential,
  type CredentialReference,
} from '@/lib/api';
import {
  Settings,
  KeyRound,
  Shield,
  Plus,
  Trash2,
  X,
  Database,
  Lock,
  Sun,
  Moon,
  Monitor,
  Accessibility,
  Palette,
  Loader2,
} from 'lucide-react';

// ── Add Credential Form ──

function AddCredentialForm({ mode, onSaved, onCancel }: { mode: 'user' | 'admin'; onSaved: () => void; onCancel: () => void }) {
  const [targetSystem, setTargetSystem] = useState('');
  const [authMethod, setAuthMethod] = useState('form_login');
  const [loginUrl, setLoginUrl] = useState('');
  const [mfaMethod, setMfaMethod] = useState('');
  const [secretScope, setSecretScope] = useState('sc_auditor_credentials');
  const [usernameKey, setUsernameKey] = useState('');
  const [passwordKey, setPasswordKey] = useState('');
  const [ucConnectionName, setUcConnectionName] = useState('');
  const [tokenUrl, setTokenUrl] = useState('');
  const [scopes, setScopes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetSystem.trim()) return;
    setSaving(true);
    try {
      await createCredential({
        targetSystem: targetSystem.trim(),
        credentialSource: mode === 'user' ? 'secret_scope' : 'uc_connection',
        authMethod,
        loginUrl: loginUrl.trim() || undefined,
        mfaMethod: mfaMethod || undefined,
        ...(mode === 'user'
          ? { secretScope: secretScope.trim(), usernameKey: usernameKey.trim() || undefined, passwordKey: passwordKey.trim() || undefined }
          : { ucConnectionName: ucConnectionName.trim() || undefined, tokenUrl: tokenUrl.trim() || undefined, scopes: scopes.trim() || undefined, isAdminManaged: true }),
      });
      onSaved();
    } catch (err) { console.error('Save credential failed:', err); }
    finally { setSaving(false); }
  }

  return (
    <Card className="mb-4 animate-[scaleIn_var(--motion-moderate)_var(--ease-out)]" elevated>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-primary)]">{mode === 'user' ? 'Add User Credential' : 'Add Admin M2M Connection'}</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}><X size={16} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Target System" value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)} placeholder="e.g., Epic Claims, SAP Finance" required />
            <Select label="Auth Method" value={authMethod} onChange={(e) => setAuthMethod(e.target.value)}
              options={mode === 'user'
                ? [{ value: 'form_login', label: 'Form Login' }, { value: 'basic', label: 'Basic Auth' }, { value: 'sso', label: 'SSO' }, { value: 'mfa', label: 'MFA' }]
                : [{ value: 'oauth2_m2m', label: 'OAuth2 M2M' }, { value: 'oauth2_auth_code', label: 'OAuth2 Auth Code' }]}
            />
          </div>
          <Input label="Login URL" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://target-system.example.com/login" type="url" />
          {mode === 'user' ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Secret Scope" value={secretScope} onChange={(e) => setSecretScope(e.target.value)} placeholder="sc_auditor_credentials" className="font-mono text-xs" />
                <Input label="Username Key" value={usernameKey} onChange={(e) => setUsernameKey(e.target.value)} placeholder="sc_cred_user_epic_username" className="font-mono text-xs" />
                <Input label="Password Key" value={passwordKey} onChange={(e) => setPasswordKey(e.target.value)} placeholder="sc_cred_user_epic_password" className="font-mono text-xs" />
              </div>
              {authMethod === 'mfa' && (
                <Select label="MFA Method" value={mfaMethod} onChange={(e) => setMfaMethod(e.target.value)}
                  options={[{ value: '', label: 'Select MFA method...' }, { value: 'totp', label: 'TOTP (Authenticator App)' }, { value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' }, { value: 'push', label: 'Push Notification' }]}
                />
              )}
              <p className="text-xs text-[var(--text-tertiary)]">Credentials are stored in a Databricks secret scope. Only key references are saved here.</p>
            </>
          ) : (
            <>
              <Input label="UC Connection Name" value={ucConnectionName} onChange={(e) => setUcConnectionName(e.target.value)} placeholder="sc_auditor_epic_m2m" className="font-mono text-xs" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Token URL" value={tokenUrl} onChange={(e) => setTokenUrl(e.target.value)} placeholder="https://auth.target.com/oauth2/token" type="url" />
                <Input label="Scopes" value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder="openid profile api.read" />
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Admin-managed M2M credentials use Unity Catalog connections. Shared across all users.</p>
            </>
          )}
          <div className="pt-2">
            <Button type="submit" disabled={saving || !targetSystem.trim()}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? 'Saving...' : 'Add Credential'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Credential Row ──

function CredentialRow({ cred, onDelete }: { cred: CredentialReference; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Remove credential for "${cred.target_system}"?`)) return;
    setDeleting(true);
    try { await deleteCredential(cred.id); onDelete(); }
    catch (err) { console.error('Delete failed:', err); }
    finally { setDeleting(false); }
  }

  return (
    <div className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-tertiary)] transition-colors duration-[var(--motion-fast)]">
      <div className="w-9 h-9 rounded-xl bg-[var(--surface-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
        {cred.credential_source === 'secret_scope' ? <KeyRound size={16} /> : <Database size={16} />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-[var(--text-primary)]">{cred.target_system}</span>
          <Badge>{cred.auth_method}</Badge>
          {cred.is_admin_managed && <Badge variant="info">shared</Badge>}
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
          {cred.credential_source === 'secret_scope'
            ? `${cred.secret_scope} / ${cred.username_key ?? '(no key)'}`
            : `UC Connection: ${cred.uc_connection_name ?? '(not set)'}`}
          {cred.login_url && ` \u2022 ${cred.login_url}`}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

// ── Main Settings Page ──

export function SettingsPage() {
  const { theme, setTheme, accessibilityMode, setAccessibilityMode } = useTheme();
  const [credentials, setCredentials] = useState<CredentialReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const [showAddForm, setShowAddForm] = useState(false);

  function refresh() {
    listCredentials()
      .then((data) => setCredentials(data.credentials))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

  const userCreds = credentials.filter((c) => c.credential_source === 'secret_scope' && !c.is_admin_managed);
  const adminCreds = credentials.filter((c) => c.credential_source === 'uc_connection' || c.is_admin_managed);
  const activeCreds = activeTab === 'user' ? userCreds : adminCreds;

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: <Sun size={16} />, desc: 'Light background with dark text' },
    { value: 'dark' as const, label: 'Dark', icon: <Moon size={16} />, desc: 'Dark background with light text' },
    { value: 'system' as const, label: 'System', icon: <Monitor size={16} />, desc: 'Follow your OS preference' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-[var(--surface-tertiary)] flex items-center justify-center text-[var(--accent-primary)]">
          <Settings size={20} />
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--accent-primary)] uppercase tracking-widest">Preferences</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Settings</h1>
        </div>
      </div>
      <p className="text-[var(--text-secondary)] mb-8 ml-12">Manage credentials, appearance, and agent preferences.</p>

      {/* ── Appearance Section ── */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Palette size={18} /> Appearance
        </h2>
        <Card elevated>
          <CardContent className="space-y-6">
            {/* Theme selector */}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map(({ value, label, icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-[var(--motion-fast)] ${
                      theme === value
                        ? 'border-[var(--accent-primary)] bg-[var(--surface-tertiary)] shadow-sm'
                        : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-tertiary)]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === value ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--surface-tertiary)] text-[var(--text-secondary)]'}`}>
                      {icon}
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
                    <span className="text-xs text-[var(--text-tertiary)] text-center">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Accessibility */}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Accessibility</p>
              <button
                onClick={() => setAccessibilityMode(accessibilityMode === 'normal' ? 'high-contrast' : 'normal')}
                className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 transition-all duration-[var(--motion-fast)] ${
                  accessibilityMode === 'high-contrast'
                    ? 'border-[var(--accent-info)] bg-[var(--accent-info-subtle)]'
                    : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accessibilityMode === 'high-contrast' ? 'bg-[var(--accent-info)] text-white' : 'bg-[var(--surface-tertiary)] text-[var(--text-secondary)]'}`}>
                  <Accessibility size={20} />
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-[var(--text-primary)]">High Contrast Mode</span>
                  <p className="text-xs text-[var(--text-secondary)]">Enhanced contrast for better readability</p>
                </div>
                <div className={`ml-auto w-10 h-6 rounded-full transition-colors duration-[var(--motion-fast)] ${accessibilityMode === 'high-contrast' ? 'bg-[var(--accent-info)]' : 'bg-[var(--border-default)]'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-[var(--motion-fast)] mt-0.5 ${accessibilityMode === 'high-contrast' ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Credential Management ── */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Lock size={18} /> Credential Management
        </h2>

        <div className="flex border-b border-[var(--border-default)] mb-4">
          {[
            { key: 'user' as const, label: 'User Credentials', icon: <KeyRound size={14} />, count: userCreds.length },
            { key: 'admin' as const, label: 'Admin M2M', icon: <Shield size={14} />, count: adminCreds.length },
          ].map(({ key, label, icon, count }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setShowAddForm(false); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-[var(--motion-fast)] ${
                activeTab === key
                  ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-2">{icon} {label} ({count})</span>
            </button>
          ))}
        </div>

        {showAddForm && (
          <AddCredentialForm mode={activeTab} onSaved={() => { setShowAddForm(false); refresh(); }} onCancel={() => setShowAddForm(false)} />
        )}

        <Card>
          <div className="px-6 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <p className="text-sm text-[var(--text-secondary)]">
              {activeTab === 'user' ? 'Personal credentials stored in Databricks secret scope' : 'Shared M2M credentials via Unity Catalog connections'}
            </p>
            {!showAddForm && <Button size="sm" onClick={() => setShowAddForm(true)}><Plus size={14} /> Add</Button>}
          </div>
          {loading ? (
            <div className="px-6 py-12 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 w-full" />)}</div>
          ) : activeCreds.length === 0 ? (
            <EmptyState
              icon={activeTab === 'user' ? <KeyRound size={28} /> : <Shield size={28} />}
              title={activeTab === 'user' ? 'No user credentials' : 'No M2M connections'}
              description={activeTab === 'user'
                ? 'Add personal login credentials for target systems.'
                : 'Register Unity Catalog connections for service principal OAuth2 flows.'}
              action={!showAddForm ? <Button size="sm" onClick={() => setShowAddForm(true)}><Plus size={14} /> {activeTab === 'user' ? 'Add Credential' : 'Add M2M Connection'}</Button> : undefined}
            />
          ) : (
            <div>{activeCreds.map((cred) => <CredentialRow key={cred.id} cred={cred} onDelete={refresh} />)}</div>
          )}
        </Card>
      </section>

      {/* ── Agent Preferences ── */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Settings size={18} /> Agent Preferences
        </h2>
        <Card>
          <CardContent className="space-y-4">
            <Select label="Default Screenshot Format" value="png" onChange={() => {}} options={[{ value: 'png', label: 'PNG (lossless)' }, { value: 'jpeg', label: 'JPEG (smaller file size)' }]} />
            <Select label="Browser Viewport" value="1920x1080" onChange={() => {}}
              options={[
                { value: '1920x1080', label: '1920 x 1080 (Full HD)' },
                { value: '1366x768', label: '1366 x 768 (Laptop)' },
                { value: '1440x900', label: '1440 x 900 (MacBook)' },
                { value: '2560x1440', label: '2560 x 1440 (QHD)' },
              ]}
            />
            <Select label="Max Agent Rounds per Message" value="15" onChange={() => {}}
              options={[
                { value: '5', label: '5 (conservative)' },
                { value: '10', label: '10' },
                { value: '15', label: '15 (default)' },
                { value: '25', label: '25 (extended)' },
              ]}
            />
            <p className="text-xs text-[var(--text-tertiary)] pt-2">
              Agent preferences are stored locally and apply to all future audit sessions.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
