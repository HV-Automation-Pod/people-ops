"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  UserCircle2,
  Unplug,
  Sparkles,
  ExternalLink,
  LogOut,
  Palette,
  Plug,
  User as UserIcon,
  ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Label } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Tooltip } from "@/components/ui/tooltip";
import { SlackMark } from "@/components/icons/slack-mark";
import { useBackOnEscape } from "@/lib/use-back-on-escape";
import type { ProfilePayload } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  hr_manager: "HR Manager",
  hr_ops: "HR Ops",
  member: "Member",
};

type Section = "account" | "integrations";

interface SectionItem {
  id: Section;
  label: string;
  description: string;
  icon: React.ElementType;
}

const SECTIONS: SectionItem[] = [
  {
    id: "account",
    label: "Account",
    description: "Theme · Sign out",
    icon: UserIcon,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Slack · future tools",
    icon: Plug,
  },
];

export default function ProfilePage() {
  const { user, authFetch, logout } = useAuth();
  useBackOnEscape("/");

  const [section, setSection] = useState<Section>("account");
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [bot, setBot] = useState("");
  const [usr, setUsr] = useState("");
  const [showBot, setShowBot] = useState(false);
  const [showUsr, setShowUsr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    authFetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setProfile(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

  const isConnected =
    !!profile?.slack_user_token_preview &&
    !!profile?.slack_bot_token_preview &&
    !!profile?.slack_connected_as;

  const isStale =
    !!profile?.slack_user_token_preview && !profile?.slack_connected_as;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api/profile/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: bot, user_token: usr }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      const pRes = await authFetch("/api/profile");
      if (pRes.ok) setProfile(await pRes.json());
      setBot("");
      setUsr("");
      setEditing(false);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setSaving(true);
    setError(null);
    try {
      await authFetch("/api/profile/slack", { method: "DELETE" });
      const pRes = await authFetch("/api/profile");
      if (pRes.ok) setProfile(await pRes.json());
      setBot("");
      setUsr("");
      setEditing(false);
      setConfirmDisconnect(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) return <LoadingScreen message="Loading profile..." />;

  const firstName = profile.name?.split(" ")[0] ?? "";
  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;

  return (
    <div className="min-h-screen bg-stone-25 dark:bg-stone-950">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50 border-b border-stone-100 dark:border-stone-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Tooltip label="Back" shortcut="Esc" align="start">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<ArrowLeft className="h-3.5 w-3.5" />}
                >
                  Back
                </Button>
              </Link>
            </Tooltip>
            <div className="h-5 w-px bg-stone-150 dark:bg-stone-800" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-sm shadow-indigo-500/20">
                <UserCircle2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  Your Profile
                </h1>
                <p className="text-[10px] text-stone-400 dark:text-stone-500">
                  Account & integrations
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 page-enter">
        {/* Identity */}
        <div className="mb-8 flex items-center gap-5">
          <Avatar name={profile.name} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                {firstName || profile.name}
              </h2>
              <Badge variant={profile.role === "admin" ? "coral" : "muted"}>
                {profile.role === "admin" && <Shield className="mr-0.5 h-3 w-3" />}
                {roleLabel}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
              {profile.email}
            </p>
          </div>
        </div>

        {/* Sidebar + content */}
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <aside className="md:sticky md:top-[84px] md:self-start">
            <nav className="flex flex-row gap-1.5 overflow-x-auto rounded-2xl border border-stone-150 bg-white p-2 shadow-soft md:flex-col dark:border-stone-800 dark:bg-stone-850">
              {SECTIONS.map((s) => {
                const active = section === s.id;
                const SI = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={clsx(
                      "group flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all duration-150",
                      "min-w-max md:min-w-0 md:w-full",
                      active
                        ? "bg-gradient-to-b from-coral-500 to-coral-600 text-white shadow-sm shadow-coral-500/20"
                        : "text-stone-500 hover:bg-stone-50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                    )}
                  >
                    <div
                      className={clsx(
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
                        active
                          ? "bg-white/15"
                          : "bg-stone-100 group-hover:bg-white dark:bg-stone-900 dark:group-hover:bg-stone-750"
                      )}
                    >
                      <SI className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          "text-xs font-bold tracking-tight",
                          active
                            ? "text-white"
                            : "text-stone-700 group-hover:text-stone-900 dark:text-stone-200 dark:group-hover:text-stone-100"
                        )}
                      >
                        {s.label}
                      </p>
                      <p
                        className={clsx(
                          "text-[10px] font-medium",
                          active
                            ? "text-white/70"
                            : "text-stone-400 dark:text-stone-500"
                        )}
                      >
                        {s.description}
                      </p>
                    </div>
                    <ChevronRight
                      className={clsx(
                        "hidden h-3.5 w-3.5 flex-shrink-0 transition-transform md:block",
                        active
                          ? "text-white/70 translate-x-0"
                          : "text-stone-300 dark:text-stone-600 group-hover:translate-x-0.5"
                      )}
                    />
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            {section === "account" && (
              <AccountTab
                onSignOutRequested={() => setConfirmSignOut(true)}
              />
            )}
            {section === "integrations" && (
              <IntegrationsTab
                profile={profile}
                isConnected={isConnected}
                isStale={isStale}
                editing={editing}
                setEditing={setEditing}
                bot={bot}
                usr={usr}
                setBot={setBot}
                setUsr={setUsr}
                showBot={showBot}
                showUsr={showUsr}
                setShowBot={setShowBot}
                setShowUsr={setShowUsr}
                saving={saving}
                error={error}
                savedAt={savedAt}
                onSave={save}
                onDisconnectRequested={() => setConfirmDisconnect(true)}
              />
            )}
          </section>
        </div>
      </main>

      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={disconnect}
        title="Disconnect Slack?"
        description={
          <>
            Your Slack tokens will be removed from this account. You won&apos;t
            be able to send gratuity dispatches until you reconnect.
          </>
        }
        destructiveNote="You'll need to paste the tokens again to reconnect."
        confirmLabel="Disconnect"
        variant="danger"
      />

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={logout}
        title="Sign out of People Ops?"
        description={
          <>
            This will end your session on this device. You&apos;ll return to
            the login page.
          </>
        }
        confirmLabel="Sign out"
        variant="danger"
      />
    </div>
  );
}

// ============================================================================
// ACCOUNT TAB
// ============================================================================
function AccountTab({
  onSignOutRequested,
}: {
  onSignOutRequested: () => void;
}) {

  return (
    <div className="space-y-5">
      {/* Appearance */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-start gap-4 border-b border-stone-100 p-6 dark:border-stone-800">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-500/20">
            <Palette className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Appearance
            </h3>
            <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
              Pick your theme. System follows your OS setting.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between p-6">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Theme
          </span>
          <ThemeToggle />
        </div>
      </Card>

      {/* Sign out */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-start gap-4 border-b border-stone-100 p-6 dark:border-stone-800">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 shadow-sm shadow-rose-500/20">
            <LogOut className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Sign out
            </h3>
            <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
              End your session on this device. You&apos;ll return to the login page.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end p-6">
          <Button
            variant="danger"
            size="sm"
            icon={<LogOut className="h-3.5 w-3.5" />}
            onClick={onSignOutRequested}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// INTEGRATIONS TAB
// ============================================================================
function IntegrationsTab({
  profile,
  isConnected,
  isStale,
  editing,
  setEditing,
  bot,
  usr,
  setBot,
  setUsr,
  showBot,
  showUsr,
  setShowBot,
  setShowUsr,
  saving,
  error,
  savedAt,
  onSave,
  onDisconnectRequested,
}: {
  profile: ProfilePayload;
  isConnected: boolean;
  isStale: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;
  bot: string;
  usr: string;
  setBot: (v: string) => void;
  setUsr: (v: string) => void;
  showBot: boolean;
  showUsr: boolean;
  setShowBot: (v: boolean) => void;
  setShowUsr: (v: boolean) => void;
  saving: boolean;
  error: string | null;
  savedAt: number | null;
  onSave: () => void;
  onDisconnectRequested: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Slack integration */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-start justify-between border-b border-stone-100 p-6 dark:border-stone-800">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-stone-150 dark:bg-stone-900 dark:ring-stone-700">
              <SlackMark size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  Slack
                </h3>
                {isConnected && (
                  <Badge variant="emerald" dot>
                    Connected
                  </Badge>
                )}
                {isStale && (
                  <Badge variant="amber" dot>
                    Token expired
                  </Badge>
                )}
                {!isConnected && !isStale && (
                  <Badge variant="muted">Not connected</Badge>
                )}
              </div>
              <p className="mt-1 max-w-md text-[11px] leading-relaxed text-stone-400 dark:text-stone-500">
                Dispatches from this platform send as you. Employees receive the
                DM from your personal Slack account, not a bot.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isConnected && !editing ? (
            <ConnectedView
              profile={profile}
              onEdit={() => setEditing(true)}
              onDisconnect={onDisconnectRequested}
              saving={saving}
              savedAt={savedAt}
            />
          ) : (
            <EditForm
              initialBot={bot}
              initialUsr={usr}
              setBot={setBot}
              setUsr={setUsr}
              showBot={showBot}
              showUsr={showUsr}
              setShowBot={setShowBot}
              setShowUsr={setShowUsr}
              saving={saving}
              error={error}
              onSave={onSave}
              onCancel={
                isConnected
                  ? () => {
                      setEditing(false);
                      setBot("");
                      setUsr("");
                    }
                  : undefined
              }
            />
          )}
        </div>
      </Card>

      {/* Required scopes */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
            <KeyRound className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="flex-1">
            <p className="mb-3 text-sm font-bold text-stone-800 dark:text-stone-100">
              Required Slack scopes
            </p>
            <p className="mb-4 text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
              Add these scopes in your Slack app&apos;s <b>OAuth &amp; Permissions</b>{" "}
              page, then <b>reinstall the app</b> to the workspace so the tokens
              pick up the new scopes.
            </p>

            <div className="space-y-4">
              <ScopeBlock
                title="User Token Scopes"
                prefix="xoxp-"
                subtitle="Required — this is the token sends use"
                scopes={[
                  { name: "chat:write", why: "Post DMs as you" },
                  { name: "files:write", why: "Upload attachments to Slack" },
                  {
                    name: "im:write",
                    why: "Open a DM channel with the employee",
                  },
                ]}
              />
              <ScopeBlock
                title="Bot Token Scopes"
                prefix="xoxb-"
                subtitle="Required — used to resolve employees by email"
                scopes={[
                  {
                    name: "users:read",
                    why: "Prerequisite for users:read.email",
                  },
                  {
                    name: "users:read.email",
                    why: "Find the Slack user_id for an employee email",
                  },
                ]}
              />
            </div>

            <p className="mt-4 text-[10px] italic leading-relaxed text-stone-400 dark:text-stone-500">
              Seeing a &ldquo;missing_scope&rdquo; error? Slack caches scopes on
              the token — after adding a new scope you must click{" "}
              <b>&ldquo;Reinstall to Workspace&rdquo;</b> in your app settings,
              then copy the fresh tokens here and click <b>Update tokens</b>.
            </p>
          </div>
        </div>
      </Card>

      {/* How to get tokens */}
      <Card className="!bg-stone-50/60 dark:!bg-stone-900/40">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
            <p className="mb-1.5 font-semibold text-stone-700 dark:text-stone-200">
              How to get your tokens
            </p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Open your HyperVerge Slack app settings.</li>
              <li>
                Under <b>OAuth &amp; Permissions</b>, add the scopes listed above.
              </li>
              <li>
                Click <b>&ldquo;Reinstall to Workspace&rdquo;</b> so the tokens
                pick up the new scopes.
              </li>
              <li>
                Copy the{" "}
                <code className="rounded bg-stone-100 px-1 py-0.5 text-[10px] dark:bg-stone-800">
                  Bot User OAuth Token
                </code>{" "}
                (<code>xoxb-</code>) and{" "}
                <code className="rounded bg-stone-100 px-1 py-0.5 text-[10px] dark:bg-stone-800">
                  User OAuth Token
                </code>{" "}
                (<code>xoxp-</code>).
              </li>
              <li>Paste both here. We verify them with Slack before saving.</li>
            </ol>
            <a
              href="https://api.slack.com/authentication/token-types"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-semibold text-indigo-500 hover:underline dark:text-indigo-400"
            >
              Slack token types reference
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// CONNECTED VIEW
// ============================================================================
function ConnectedView({
  profile,
  onEdit,
  onDisconnect,
  saving,
  savedAt,
}: {
  profile: ProfilePayload;
  onEdit: () => void;
  onDisconnect: () => void;
  saving: boolean;
  savedAt: number | null;
}) {
  return (
    <div className="space-y-4">
      {savedAt && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 text-[11px] font-semibold text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Tokens verified and saved
        </div>
      )}

      {profile.slack_connected_as && (
        <div className="rounded-xl border border-stone-100 bg-stone-25 p-4 dark:border-stone-800 dark:bg-stone-900/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Connected as
              </p>
              <p className="mt-1 text-sm font-bold text-stone-800 dark:text-stone-100">
                {profile.slack_connected_as.team}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-stone-400">
                user_id: {profile.slack_connected_as.user_id}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-stone-150 dark:bg-stone-900 dark:ring-stone-700">
              <SlackMark size={22} />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <TokenDisplay
          label="Bot token"
          icon={<KeyRound className="h-3.5 w-3.5" />}
          value={profile.slack_bot_token_preview}
        />
        <TokenDisplay
          label="User token"
          icon={<KeyRound className="h-3.5 w-3.5" />}
          value={profile.slack_user_token_preview}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<Unplug className="h-3.5 w-3.5" />}
          onClick={onDisconnect}
          disabled={saving}
        >
          Disconnect
        </Button>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Update tokens
        </Button>
      </div>
    </div>
  );
}

function TokenDisplay({
  label,
  icon,
  value,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-stone-100 bg-white p-3.5 dark:border-stone-800 dark:bg-stone-850">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
        {icon}
        {label}
      </div>
      <p className="font-mono text-xs text-stone-600 dark:text-stone-300">
        {value ?? "Not set"}
      </p>
    </div>
  );
}

// ============================================================================
// EDIT FORM
// ============================================================================
function EditForm({
  initialBot,
  initialUsr,
  setBot,
  setUsr,
  showBot,
  showUsr,
  setShowBot,
  setShowUsr,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initialBot: string;
  initialUsr: string;
  setBot: (v: string) => void;
  setUsr: (v: string) => void;
  showBot: boolean;
  showUsr: boolean;
  setShowBot: (v: boolean) => void;
  setShowUsr: (v: boolean) => void;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel?: () => void;
}) {
  const canSave =
    initialBot.trim().startsWith("xoxb-") &&
    initialUsr.trim().startsWith("xoxp-") &&
    !saving;

  return (
    <div className="space-y-5">
      <div>
        <Label hint="starts with xoxb-">Bot User OAuth Token</Label>
        <TokenInput
          value={initialBot}
          onChange={setBot}
          visible={showBot}
          onToggle={() => setShowBot(!showBot)}
          placeholder="xoxb-…"
          invalid={!!initialBot && !initialBot.trim().startsWith("xoxb-")}
        />
      </div>

      <div>
        <Label hint="starts with xoxp-">User OAuth Token</Label>
        <TokenInput
          value={initialUsr}
          onChange={setUsr}
          visible={showUsr}
          onToggle={() => setShowUsr(!showUsr)}
          placeholder="xoxp-…"
          invalid={!!initialUsr && !initialUsr.trim().startsWith("xoxp-")}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200/60 bg-rose-50/40 px-3.5 py-2.5 text-[11px] text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-stone-400 dark:text-stone-500">
          We verify each token with Slack before saving.
        </p>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={!canSave}
            loading={saving}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          >
            {saving ? "Verifying…" : "Save & verify"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScopeBlock({
  title,
  prefix,
  subtitle,
  scopes,
}: {
  title: string;
  prefix: string;
  subtitle: string;
  scopes: { name: string; why: string }[];
}) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-25 p-4 dark:border-stone-800 dark:bg-stone-900/50">
      <div className="mb-0.5 flex items-center gap-2">
        <span className="text-[11px] font-bold text-stone-700 dark:text-stone-200">
          {title}
        </span>
        <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
          {prefix}
        </code>
      </div>
      <p className="mb-3 text-[10px] text-stone-400 dark:text-stone-500">
        {subtitle}
      </p>
      <div className="space-y-1.5">
        {scopes.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-1.5 dark:bg-stone-850"
          >
            <code className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              {s.name}
            </code>
            <span className="text-right text-[10px] text-stone-400 dark:text-stone-500">
              {s.why}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenInput({
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        invalid={invalid}
        className="pr-10 font-mono tracking-tight"
      />
      <Tooltip label={visible ? "Hide" : "Show"} position="top" align="end">
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
        >
          {visible ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
