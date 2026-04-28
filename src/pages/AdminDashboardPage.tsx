import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_DEPARTMENTS, ISSUE_LEVEL_OPTIONS, MODULES, STATUS_OPTIONS } from '../lib/constants';
import {
  addDepartment,
  deleteDepartment,
  getAllTickets,
  getDepartments,
  updateTicketNotes,
  updateTicketStatus,
} from '../lib/tickets';
import type { Ticket, TicketStatus } from '../types';
import { useAuth } from '../context/AuthContext';

interface Filters {
  department: string;
  module: string;
  status: string;
  issueLevel: string;
}

const defaultFilters: Filters = {
  department: '',
  module: '',
  status: '',
  issueLevel: '',
};

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [newDepartment, setNewDepartment] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deptBusy, setDeptBusy] = useState(false);

  async function fetchTickets() {
    setLoading(true);
    setError('');
    try {
      const data = await getAllTickets({
        department: filters.department || undefined,
        module: filters.module || undefined,
        status: filters.status || undefined,
        issueLevel: filters.issueLevel || undefined,
      });
      setTickets(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department, filters.module, filters.status, filters.issueLevel]);

  useEffect(() => {
    void refreshDepartments();
  }, []);

  async function refreshDepartments() {
    try {
      const data = await getDepartments();
      if (data.length > 0) {
        setDepartments(data);
      }
    } catch {
      setDepartments(DEFAULT_DEPARTMENTS);
    }
  }

  async function onStatusChange(ticketId: string, status: TicketStatus) {
    await updateTicketStatus(ticketId, status);
    await fetchTickets();
  }

  async function onSaveNotes(ticketId: string, notes: string) {
    await updateTicketNotes(ticketId, notes);
    await fetchTickets();
  }

  async function onAddDepartment() {
    if (!newDepartment.trim()) return;
    setDeptBusy(true);
    setError('');
    try {
      await addDepartment(newDepartment);
      setNewDepartment('');
      await refreshDepartments();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeptBusy(false);
    }
  }

  async function onDeleteDepartment(name: string) {
    setDeptBusy(true);
    setError('');
    try {
      await deleteDepartment(name);
      if (filters.department === name) {
        setFilters((f) => ({ ...f, department: '' }));
      }
      await refreshDepartments();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeptBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Support Dashboard</h2>
          <p className="hint">Role: {profile?.role}</p>
        </div>
        <Link className="primary-btn-link" to="/">
          Submit Ticket View
        </Link>
      </header>

      <section className="card">
        <h3>Filters</h3>
        <div className="filter-grid">
          <label>
            Department
            <select
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
            >
              <option value="">All</option>
              {departments.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </label>

          <label>
            Module
            <select
              value={filters.module}
              onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value }))}
            >
              <option value="">All</option>
              {MODULES.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Issue Level
            <select
              value={filters.issueLevel}
              onChange={(e) => setFilters((f) => ({ ...f, issueLevel: e.target.value }))}
            >
              <option value="">All</option>
              {ISSUE_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Department Settings</h3>
        <div className="dept-settings">
          <input
            type="text"
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            placeholder="Add new department"
          />
          <button className="primary" type="button" disabled={deptBusy} onClick={() => void onAddDepartment()}>
            Add Department
          </button>
        </div>
        <div className="chip-wrap">
          {departments.map((dep) => (
            <button
              key={dep}
              type="button"
              className="chip"
              disabled={deptBusy}
              onClick={() => void onDeleteDepartment(dep)}
              title="Click to delete"
            >
              {dep} x
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h3>Tickets ({tickets.length})</h3>
          {loading && <span>Loading...</span>}
        </div>
        {error && <div className="error">{error}</div>}

        <div className="ticket-list">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onStatusChange={onStatusChange}
              onSaveNotes={onSaveNotes}
            />
          ))}
          {!loading && tickets.length === 0 && <p>No tickets found with current filters.</p>}
        </div>
      </section>
    </div>
  );
}

function TicketCard({
  ticket,
  onStatusChange,
  onSaveNotes,
}: {
  ticket: Ticket;
  onStatusChange: (ticketId: string, status: TicketStatus) => Promise<void>;
  onSaveNotes: (ticketId: string, notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(ticket.internalNotes ?? '');
  const [busy, setBusy] = useState(false);

  async function handleSaveNotes() {
    setBusy(true);
    await onSaveNotes(ticket.id, notes);
    setBusy(false);
  }

  async function handleStatusChange(nextStatus: TicketStatus) {
    setBusy(true);
    await onStatusChange(ticket.id, nextStatus);
    setBusy(false);
  }

  return (
    <article className="ticket-card">
      <div className="row-between">
        <strong>Ticket #{ticket.id.slice(0, 8)}</strong>
        <span className={`badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>{ticket.status}</span>
      </div>

      <p>
        <strong>Department:</strong> {ticket.department} | <strong>Module:</strong> {ticket.module}
      </p>
      <p>
        <strong>Reported by:</strong> {ticket.createdByEmail}
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

      {ticket.screenshotUrl && (
        <a href={ticket.screenshotUrl} target="_blank" rel="noreferrer">
          <img className="screenshot" src={ticket.screenshotUrl} alt="Ticket screenshot" />
        </a>
      )}

      <label>
        Status
        <select
          value={ticket.status}
          disabled={busy}
          onChange={(e) => void handleStatusChange(e.target.value as TicketStatus)}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label>
        Internal Notes
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <button className="secondary" type="button" onClick={() => void handleSaveNotes()} disabled={busy}>
        {busy ? 'Saving...' : 'Save Notes'}
      </button>
    </article>
  );
}
