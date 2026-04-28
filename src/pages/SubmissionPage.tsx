import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_DEPARTMENTS, ISSUE_LEVEL_OPTIONS, MAX_SCREENSHOT_MB, MODULES } from '../lib/constants';
import { createTicket, getDepartments, getEmployeeTickets, uploadTicketScreenshot } from '../lib/tickets';
import { useAuth } from '../context/AuthContext';
import type { Ticket } from '../types';

export default function SubmissionPage() {
  const { user, profile, isManagerOrSupport } = useAuth();
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [department, setDepartment] = useState(DEFAULT_DEPARTMENTS[0] ?? '');
  const [moduleName, setModuleName] = useState(MODULES[0]);
  const [issueLevel, setIssueLevel] = useState<(typeof ISSUE_LEVEL_OPTIONS)[number]>('Medium');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getDepartments();
        if (data.length > 0) {
          setDepartments(data);
          setDepartment((prev) => (data.includes(prev) ? prev : data[0]));
        }
      } catch {
        setDepartments(DEFAULT_DEPARTMENTS);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadMyTickets(user.id);
  }, [user]);

  async function loadMyTickets(userId: string) {
    setHistoryBusy(true);
    try {
      const data = await getEmployeeTickets(userId);
      setTickets(data);
    } catch {
      setTickets([]);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      let screenshotResult: { path: string; url: string } | undefined;
      if (screenshot) {
        screenshotResult = await uploadTicketScreenshot(screenshot, user.id);
      }

      const ticketId = await createTicket(
        {
          department,
          module: moduleName,
          description,
          issueLevel,
        },
        screenshotResult
      );

      setDescription('');
      setScreenshot(null);
      setMessage(`Ticket submitted successfully. Ticket ID: ${ticketId}`);
      await loadMyTickets(user.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Submit Issue Ticket</h2>
          <p className="hint">Logged in as {profile?.email}</p>
        </div>
        <div className="nav-actions">
          <Link className="primary-btn-link" to="/history">
            Ticket History
          </Link>
          {isManagerOrSupport && (
            <Link className="primary-btn-link" to="/admin">
              Go to Dashboard
            </Link>
          )}
        </div>
      </header>

      <section className="card">
        <form onSubmit={handleSubmit} className="stack">
          <label>
            Department
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              {departments.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </label>

          <label>
            Module
            <select value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
              {MODULES.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </label>

          <label>
            Issue Level
            <select value={issueLevel} onChange={(e) => setIssueLevel(e.target.value as (typeof ISSUE_LEVEL_OPTIONS)[number])}>
              {ISSUE_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label>
            Error Description
            <textarea
              required
              minLength={10}
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, expected behavior, and what actually happened."
            />
          </label>

          <label>
            Screenshot Upload (optional, max {MAX_SCREENSHOT_MB}MB)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            />
          </label>

          {message && <div className="success">{message}</div>}
          {error && <div className="error">{error}</div>}

          <button className="primary" type="submit" disabled={busy || !department}>
            {busy ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="row-between">
          <h3>My Ticket History</h3>
          {historyBusy && <span>Loading...</span>}
        </div>

        <div className="ticket-list">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="ticket-card">
              <div className="row-between">
                <strong>Ticket #{ticket.id.slice(0, 8)}</strong>
                <span className={`badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>{ticket.status}</span>
              </div>
              <p>
                <strong>Department:</strong> {ticket.department} | <strong>Module:</strong> {ticket.module}
              </p>
              <p>
                <strong>Description:</strong> {ticket.description}
              </p>
              <p>
                <strong>Issue Level:</strong> {ticket.issueLevel}
              </p>
              <p>
                <strong>Created:</strong> {new Date(ticket.createdAt).toLocaleString()}
              </p>
              <p>
                <strong>Last Updated:</strong> {new Date(ticket.updatedAt).toLocaleString()}
              </p>
            </article>
          ))}
          {!historyBusy && tickets.length === 0 && <p>You have not submitted any tickets yet.</p>}
        </div>
      </section>
    </div>
  );
}
