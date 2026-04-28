import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_OPTIONS } from '../lib/constants';
import { getAllTickets, getEmployeeTickets } from '../lib/tickets';
import { useAuth } from '../context/AuthContext';
import type { Ticket } from '../types';

export default function TicketHistoryPage() {
  const { user, isManagerOrSupport } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    void fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusFilter, isManagerOrSupport]);

  async function fetchHistory() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = isManagerOrSupport
        ? await getAllTickets({ status: statusFilter || undefined })
        : await getEmployeeTickets(user.id);

      const filtered = statusFilter ? data.filter((t) => t.status === statusFilter) : data;
      setTickets(filtered);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Ticket History</h2>
          <p className="hint">
            {isManagerOrSupport ? 'All tickets history (old and new).' : 'Your old and new tickets.'}
          </p>
        </div>
        <Link className="primary-btn-link" to="/">
          Back to Submit
        </Link>
      </header>

      <section className="card">
        <label>
          Status Filter
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <div className="row-between">
          <h3>History ({tickets.length})</h3>
          {loading && <span>Loading...</span>}
        </div>
        {error && <div className="error">{error}</div>}

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
              {isManagerOrSupport && (
                <p>
                  <strong>Reported by:</strong> {ticket.createdByEmail}
                </p>
              )}
            </article>
          ))}
          {!loading && tickets.length === 0 && <p>No tickets found.</p>}
        </div>
      </section>
    </div>
  );
}
