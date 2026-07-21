import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Check, Edit3, LogOut, Mail, Plus, Search, Trash2 } from "lucide-react";
import type {
  CreateCupThingInput,
  CupThing,
  CupThingCategory,
  Profile
} from "@cupthings/shared";
import { cupThingFieldLimits } from "@cupthings/shared";
import {
  AuthRequiredError,
  createCupThing,
  createProfile,
  deleteCupThing,
  getCupThing,
  getMe,
  isStorageAvailable,
  listCupThings,
  deleteAccount,
  logoutSession,
  requestLogin,
  setToken,
  StorageUnavailableError,
  updateCupThing,
  verifyLogin
} from "./api";
import { categoryLabels, categoryOptions } from "./constants";
import { RatingDisplay, StarRatingInput } from "./features/rating";
import { RecordList } from "./features/records/RecordList";
import { ReviewView } from "./features/review/ReviewView";
import { EmptyState, StatCard } from "./shared/Feedback";
import {
  endOfLocalDayIso,
  formatDateTime,
  fromDateTimeLocalValue,
  startOfLocalDayIso,
  toDateTimeLocalValue
} from "./date";

type View =
  | { name: "home" }
  | { name: "new" }
  | { name: "detail"; id: string }
  | { name: "edit"; id: string }
  | { name: "review" };

type Filters = {
  category: "" | CupThingCategory;
  from: string;
  to: string;
};

const emptyFilters: Filters = {
  category: "",
  from: "",
  to: ""
};

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileCheckAttempt, setProfileCheckAttempt] = useState(0);
  const [view, setView] = useState<View>({ name: "home" });
  const isAuthCallback = window.location.pathname === "/auth/verify";

  useEffect(() => {
    function handleAuthRequired() {
      setProfile(null);
      setProfileError("");
      setView({ name: "home" });
    }

    window.addEventListener("cupthings:auth-required", handleAuthRequired);

    if (isAuthCallback) {
      setCheckingProfile(false);
      return () => window.removeEventListener("cupthings:auth-required", handleAuthRequired);
    }

    setProfileError("");
    setCheckingProfile(true);
    getMe()
      .then(({ profile }) => setProfile(profile))
      .catch((error) => {
        if (error instanceof AuthRequiredError) return;
        setProfileError(error instanceof Error ? error.message : "Could not load your profile");
      })
      .finally(() => setCheckingProfile(false));

    return () => window.removeEventListener("cupthings:auth-required", handleAuthRequired);
  }, [isAuthCallback, profileCheckAttempt]);

  async function signOut() {
    try {
      await logoutSession();
    } finally {
      setProfile(null);
      setView({ name: "home" });
    }
  }

  async function removeAccount() {
    if (!window.confirm("Delete your account and all CupThings permanently?")) return;
    await deleteAccount();
    setProfile(null);
    setView({ name: "home" });
  }

  if (isAuthCallback) {
    return <VerifyLogin token={new URLSearchParams(window.location.search).get("token")} onReady={setProfile} />;
  }

  if (checkingProfile) {
    return <Shell title="CupThings"><p className="muted">Loading your profile...</p></Shell>;
  }

  if (profileError) {
    return (
      <Shell title="CupThings">
        <section className="emptyState">
          <h2>Could not reach your profile</h2>
          <p className="error">{profileError}</p>
          <button className="primaryButton" onClick={() => setProfileCheckAttempt((attempt) => attempt + 1)}><Search size={17} /> Retry</button>
        </section>
      </Shell>
    );
  }

  if (!profile) {
    return <Welcome onReady={setProfile} />;
  }

  return (
    <Shell
      title="CupThings"
      action={
        <div className="buttonCluster">
          <button className="iconTextButton" onClick={() => setView({ name: "new" })}>
            <Plus size={18} /> New
          </button>
          {profile.hasAccount && <button className="iconButton" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={18} /></button>}
          {profile.hasAccount && <button className="iconButton danger" aria-label="Delete account" title="Delete account" onClick={removeAccount}><Trash2 size={18} /></button>}
        </div>
      }
    >
      <div className="topbar">
        <div>
          <p className="eyebrow">Personal log</p>
          <h1>{profile.displayName}'s CupThings</h1>
        </div>
        <nav className="tabs" aria-label="Primary navigation">
          <button className={view.name === "home" ? "active" : ""} onClick={() => setView({ name: "home" })}>
            Records
          </button>
          <button className={view.name === "review" ? "active" : ""} onClick={() => setView({ name: "review" })}>
            Review
          </button>
        </nav>
      </div>

      {view.name === "home" && <HomeView onNavigate={setView} />}
      {view.name === "new" && <CupThingForm mode="create" onCancel={() => setView({ name: "home" })} onSaved={(id) => setView({ name: "detail", id })} />}
      {view.name === "detail" && <DetailView id={view.id} onNavigate={setView} />}
      {view.name === "edit" && <CupThingForm mode="edit" id={view.id} onCancel={() => setView({ name: "detail", id: view.id })} onSaved={(id) => setView({ name: "detail", id })} />}
      {view.name === "review" && <ReviewView onOpen={(id) => setView({ name: "detail", id })} />}
    </Shell>
  );
}

function Shell({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <main className="appShell">
      <header className="shellHeader">
        <div className="brandLockup">
          <span className="brand">{title}</span>
          <span className="brandSlogan">A pocket log for cups, bites, and memorable tastes.</span>
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}

function Welcome({ onReady }: { onReady: (profile: Profile) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [loginDisplayName, setLoginDisplayName] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [loginSaving, setLoginSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!isStorageAvailable()) {
      setError(new StorageUnavailableError().message);
      return;
    }
    setSaving(true);
    try {
      const result = await createProfile(displayName);
      setToken(result.token);
      onReady(result.profile);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create profile");
    } finally {
      setSaving(false);
    }
  }

  async function requestMagicLink(event: FormEvent) {
    event.preventDefault();
    setLoginMessage("");
    setLoginSaving(true);
    try {
      const result = await requestLogin(email, loginDisplayName || undefined);
      setLoginMessage(result.message);
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Could not request a sign-in link");
    } finally {
      setLoginSaving(false);
    }
  }

  return (
    <Shell title="CupThings">
      <section className="welcome">
        <div className="welcomeCopy">
          <p className="eyebrow">First visit</p>
          <h1>Start your personal taste log</h1>
          <p className="muted">Keep simple notes on the drinks and desserts you want to remember.</p>
        </div>
        <div className="welcomeForms">
          <form className="panel welcomePanel" onSubmit={submit}>
            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nic" maxLength={cupThingFieldLimits.displayName} autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primaryButton" disabled={saving || !displayName.trim()}>
              <Check size={18} /> Continue anonymously
            </button>
          </form>
          <form className="panel welcomePanel" onSubmit={requestMagicLink}>
            <div className="formHeader"><h2>Sign in with email</h2></div>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} required />
            </label>
            <label>
              Display name <span className="muted">(new accounts only)</span>
              <input value={loginDisplayName} onChange={(event) => setLoginDisplayName(event.target.value)} maxLength={80} placeholder="Nic" />
            </label>
            {loginMessage && <p className={loginMessage.startsWith("If ") ? "success" : "error"}>{loginMessage}</p>}
            <button className="ghostButton" disabled={loginSaving}><Mail size={18} /> Send Magic Link</button>
          </form>
        </div>
      </section>
    </Shell>
  );
}

function VerifyLogin({ token, onReady }: { token: string | null; onReady: (profile: Profile) => void }) {
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This sign-in link is missing a token.");
      return;
    }

    verifyLogin(token)
      .then(({ profile }) => {
        window.history.replaceState({}, "", "/");
        onReady(profile);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "This sign-in link is invalid or expired."));
  }, [token, onReady]);

  return (
    <Shell title="CupThings">
      <section className="emptyState">
        {error ? <><h2>Sign-in link unavailable</h2><p className="error">{error}</p></> : <><h2>Signing you in...</h2><p className="muted">Your CupThings profile will open in a moment.</p></>}
      </section>
    </Shell>
  );
}

function HomeView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [records, setRecords] = useState<CupThing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => ({
    category: filters.category || undefined,
    from: filters.from ? startOfLocalDayIso(filters.from) : undefined,
    to: filters.to ? endOfLocalDayIso(filters.to) : undefined
  }), [filters]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    listCupThings(query, { signal: controller.signal })
      .then(({ cupThings }) => {
        if (active) setRecords(cupThings);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError(error instanceof Error ? error.message : "Could not load records");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [query]);

  return (
    <section className="viewStack">
      <FiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Loading records...</p>
      ) : records.length === 0 ? (
        <EmptyState title="No records yet" body="Add your first CupThing to start building your log." actionLabel="Add CupThing" onAction={() => onNavigate({ name: "new" })} />
      ) : (
        <RecordList records={records} onOpen={(id) => onNavigate({ name: "detail", id })} />
      )}
    </section>
  );
}

function FiltersBar({ filters, onChange }: { filters: Filters; onChange: (filters: Filters) => void }) {
  return (
    <section className="filters" aria-label="Record filters">
      <label>
        Category
        <select value={filters.category} onChange={(event) => onChange({ ...filters, category: event.target.value as Filters["category"] })}>
          <option value="">All</option>
          {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        From
        <input type="date" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} />
      </label>
      <label>
        To
        <input type="date" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} />
      </label>
      <button className="ghostButton" onClick={() => onChange(emptyFilters)}><Search size={17} /> Clear</button>
    </section>
  );
}

function DetailView({ id, onNavigate }: { id: string; onNavigate: (view: View) => void }) {
  const [record, setRecord] = useState<CupThing | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getCupThing(id)
      .then(({ cupThing }) => setRecord(cupThing))
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load record"));
  }, [id]);

  async function remove() {
    if (!record || !window.confirm(`Delete "${record.name}"?`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteCupThing(record.id);
      onNavigate({ name: "home" });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete record");
      setDeleting(false);
    }
  }

  if (loadError) return <p className="error">{loadError}</p>;
  if (!record) return <p className="muted">Loading record...</p>;

  return (
    <section className="panel detail">
      <button className="linkButton" onClick={() => onNavigate({ name: "home" })}><ArrowLeft size={17} /> Records</button>
      <div className="detailHeader">
        <div>
          <span className={`pill ${record.category}`}>{categoryLabels[record.category]}</span>
          <h2>{record.name}</h2>
          <p className="muted">{formatDateTime(record.consumedAt)}</p>
        </div>
        <div className="buttonCluster">
          <button className="iconButton" aria-label="Edit" onClick={() => onNavigate({ name: "edit", id: record.id })}><Edit3 size={18} /></button>
          <button className="iconButton danger" aria-label="Delete" onClick={remove} disabled={deleting}><Trash2 size={18} /></button>
        </div>
      </div>
      {deleteError && <p className="error">{deleteError}</p>}
      <dl className="detailsGrid">
        <div>
          <dt>Rating</dt>
          <dd>{record.rating ? <RatingDisplay rating={record.rating} /> : "Not rated"}</dd>
        </div>
        <DetailItem label="Location" value={record.location ?? "Not set"} />
        <DetailItem label="Style" value={record.style ?? "Not set"} />
        <DetailItem label="Flavors" value={record.flavors.length ? record.flavors.join(", ") : "Not set"} />
        <DetailItem label="Notes" value={record.notes ?? "Not set"} wide />
      </dl>
    </section>
  );
}

function DetailItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "wide" : ""}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CupThingForm({
  mode,
  id,
  onCancel,
  onSaved
}: {
  mode: "create" | "edit";
  id?: string;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const [values, setValues] = useState({
    name: "",
    category: "coffee" as CupThingCategory,
    consumedAt: toDateTimeLocalValue(new Date()),
    location: "",
    style: "",
    flavors: "",
    rating: "",
    notes: ""
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    getCupThing(id).then(({ cupThing }) => {
      setValues({
        name: cupThing.name,
        category: cupThing.category,
        consumedAt: toDateTimeLocalValue(new Date(cupThing.consumedAt)),
        location: cupThing.location ?? "",
        style: cupThing.style ?? "",
        flavors: cupThing.flavors.join(", "),
        rating: cupThing.rating == null ? "" : String(cupThing.rating),
        notes: cupThing.notes ?? ""
      });
    }).catch((error) => setError(error instanceof Error ? error.message : "Could not load record"));
  }, [id, mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const input: CreateCupThingInput = {
      name: values.name,
      category: values.category,
      consumedAt: fromDateTimeLocalValue(values.consumedAt),
      location: values.location,
      style: values.style,
      flavors: values.flavors.split(",").map((value) => value.trim()).filter(Boolean),
      rating: values.rating ? Number(values.rating) : undefined,
      notes: values.notes
    };

    try {
      const result = mode === "create"
        ? await createCupThing(input)
        : await updateCupThing(id!, input);
      onSaved(result.cupThing.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel formGrid" onSubmit={submit}>
      <div className="formHeader">
        <button type="button" className="linkButton" onClick={onCancel}><ArrowLeft size={17} /> Back</button>
        <h2>{mode === "create" ? "New CupThing" : "Edit CupThing"}</h2>
      </div>
      <label className="wide">
        Name
        <input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} maxLength={cupThingFieldLimits.name} required />
      </label>
      <label>
        Category
        <select value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value as CupThingCategory })}>
          {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        Consumed at
        <input type="datetime-local" value={values.consumedAt} onChange={(event) => setValues({ ...values, consumedAt: event.target.value })} required />
      </label>
      <label>
        Location
        <input value={values.location} onChange={(event) => setValues({ ...values, location: event.target.value })} maxLength={cupThingFieldLimits.location} />
      </label>
      <label>
        Style
        <input value={values.style} onChange={(event) => setValues({ ...values, style: event.target.value })} maxLength={cupThingFieldLimits.style} />
      </label>
      <label>
        Rating
        <StarRatingInput
          value={values.rating ? Number(values.rating) : undefined}
          onChange={(rating) => setValues({ ...values, rating: rating == null ? "" : String(rating) })}
        />
      </label>
      <label className="wide">
        Flavors
        <input value={values.flavors} onChange={(event) => setValues({ ...values, flavors: event.target.value })} maxLength={cupThingFieldLimits.flavors * (cupThingFieldLimits.flavor + 1) - 1} placeholder="bright, creamy, citrus" />
      </label>
      <label className="wide">
        Notes
        <textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} maxLength={cupThingFieldLimits.notes} rows={4} />
      </label>
      {error && <p className="error wide">{error}</p>}
      <div className="formActions wide">
        <button type="button" className="ghostButton" onClick={onCancel}>Cancel</button>
        <button className="primaryButton" disabled={saving || !values.name.trim()}><Check size={18} /> Save</button>
      </div>
    </form>
  );
}
