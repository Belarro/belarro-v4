'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface FollowUp {
  id: string;
  location_id: string;
  stage: number;
  follow_up_number: number;
  flow: 'new' | 'reengage';
  total_stages: number;
  due_date: string;
  status: 'pending' | 'sent' | 'completed';
  sent_via: string | null;
  sent_date: string | null;
  notes: string | null;
  message_title: string;
  message_text: string;
  whatsapp_number: string | null;
  location: {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    interest_level: string | null;
    pipeline_stage: string | null;
    sales_rep: string | null;
  };
}

// Berlin landlines: 030..., 030..., +4930... — cannot receive WhatsApp
// Mobile (WhatsApp-capable): 01..., +491..., 1...
function isLandline(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[\s\-\+\(\)]/g, '');
  // International: 4930... = Berlin landline
  if (/^4930/.test(digits)) return true;
  // Local: 030...
  if (/^030/.test(digits)) return true;
  // Any 0[2-9] area code (not 01x mobile prefix)
  if (/^0[2-9]/.test(digits)) return true;
  return false;
}

const STAGE_COLORS: Record<number, string> = {
  1: 'bg-purple-100 text-purple-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-teal-100 text-teal-700',
  4: 'bg-amber-100 text-amber-700',
  5: 'bg-rose-100 text-rose-700',
};

interface Visit {
  location_id: string;
  restaurant_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  visited_at: string;
  notes: string | null;
  interest_level: string | null;
  pipeline_stage: string | null;
  sales_rep: string | null;
}

const INTEREST_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-500',
};

// Parse "DD-MM-YYYY HH:MM" or ISO → Date
function parseVisitDate(ts: string | null): Date | null {
  if (!ts) return null;
  const m = ts.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '00'}:${m[5] ?? '00'}:00`);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New Lead',
  active: 'Active Customer',
  snoozed: 'Snoozed',
  converted: 'Converted',
};

export default function FollowUpsPage() {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'pending' | 'done' | 'visits'>('today');

  const [selected, setSelected] = useState<FollowUp | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [logForm, setLogForm] = useState({ sent_via: 'whatsapp', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const [convertId, setConvertId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [snoozeDays, setSnoozeDays] = useState(90);
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeSuccess, setSnoozeSuccess] = useState<string | null>(null);

  const fetchFollowups = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/follow-ups');
      const json = await res.json();
      if (json.success) setFollowups(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisits = async () => {
    try {
      setVisitsLoading(true);
      setVisitsError(null);
      const res = await fetch('/api/visits');
      const json = await res.json();
      if (json.success) {
        const sorted = (json.data || []).sort((a: Visit, b: Visit) =>
          (parseVisitDate(b.visited_at)?.getTime() ?? 0) - (parseVisitDate(a.visited_at)?.getTime() ?? 0)
        );
        setVisits(sorted);
      } else {
        setVisitsError(json.error || 'Failed to load visits');
      }
    } catch (err) {
      console.error(err);
      setVisitsError('Network error loading visits');
    } finally {
      setVisitsLoading(false);
    }
  };

  useEffect(() => { fetchFollowups(); }, []);

  useEffect(() => {
    if (activeTab === 'visits') fetchVisits();
  }, [activeTab]);

  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const pending = followups.filter(f => f.status === 'pending');
  // Today: most recently added (latest due_date = latest visit) on top
  const today = pending
    .filter(f => new Date(f.due_date) <= todayEnd)
    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
  // Upcoming: soonest due date first
  const upcoming = pending
    .filter(f => new Date(f.due_date) > todayEnd)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  // Done: most recently completed on top
  const done = followups
    .filter(f => f.status === 'completed' || f.status === 'sent')
    .sort((a, b) => new Date(b.sent_date ?? b.due_date).getTime() - new Date(a.sent_date ?? a.due_date).getTime());

  const displayed = activeTab === 'today' ? today : activeTab === 'pending' ? upcoming : done;

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/follow-ups/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          sent_via: logForm.sent_via,
          notes: logForm.notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        setShowMessage(false);
        setSelected(null);
        setLogForm({ sent_via: 'whatsapp', notes: '' });
        fetchFollowups();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertToActive = async (locationId: string) => {
    if (converting) return;
    setConverting(true);
    try {
      // Update pipeline_stage in locations table to 'active'
      const res = await fetch('/api/locations/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const json = await res.json();
      if (json.success) {
        setConvertId(null);
        fetchFollowups();
      }
    } finally {
      setConverting(false);
    }
  };

  const handleSnooze = async (locationId: string) => {
    if (snoozing) return;
    setSnoozing(true);
    try {
      const res = await fetch('/api/locations/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, days: snoozeDays }),
      });
      const json = await res.json();
      if (json.success) {
        setSnoozeId(null);
        setSnoozeSuccess(json.wake_date);
        fetchFollowups();
        setTimeout(() => setSnoozeSuccess(null), 4000);
      }
    } finally {
      setSnoozing(false);
    }
  };

  const openWhatsApp = (followup: FollowUp) => {
    const number = (followup.whatsapp_number || '').replace(/\D/g, '');
    const text = encodeURIComponent(followup.message_text);
    if (number) {
      window.open(`https://wa.me/${number}?text=${text}`, '_blank');
    } else {
      // No number — just show the message to copy
    }
  };

  const Card = ({ f }: { f: FollowUp }) => {
    const isOverdue = f.status === 'pending' && new Date(f.due_date) < now;
    const restaurantName = f.location.name;
    const contactName = f.location.contact_person || f.location.name;
    const landline = isLandline(f.whatsapp_number || f.location.phone);
    const hasWhatsApp = !!(f.whatsapp_number) && !landline;

    return (
      <div className={`bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-4 hover:shadow-md transition ${isOverdue ? 'border-red-300' : 'border-gray-200'}`}>
        {/* Header */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="font-bold text-gray-900 text-base">{restaurantName}</div>
            {contactName && contactName !== restaurantName && (
              <div className="text-xs text-gray-500 mt-0.5">{contactName}</div>
            )}
          </div>
          <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full ${STAGE_COLORS[f.stage] || 'bg-gray-100 text-gray-600'}`}>
            {f.flow === 'reengage' ? 'Re-engage' : 'Lead'} {f.stage}/{f.total_stages || 5}
          </span>
        </div>

        {/* Progress dots — 4 for re-engage, 5 for new lead */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: f.total_stages || 5 }, (_, i) => i + 1).map(s => {
            const newLabels: Record<number,string> = { 1:'2h', 2:'2d', 3:'5d', 4:'2w', 5:'1m' };
            const reLabels: Record<number,string> = { 1:'now', 2:'5d', 3:'2w', 4:'1m' };
            const label = f.flow === 'reengage' ? reLabels[s] : newLabels[s];
            return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-1.5 rounded-full transition-all ${
                s < f.stage ? 'bg-green-500' :
                s === f.stage ? 'bg-green-400 animate-pulse' :
                'bg-gray-200'
              }`} />
              <span className="text-[9px] text-gray-400 font-medium">{label}</span>
            </div>
          );})}

        </div>

        {/* Contact info */}
        <div className="text-xs text-gray-500 space-y-1">
          {f.whatsapp_number && (
            <div>{landline ? '📞' : '💬'} {f.whatsapp_number}</div>
          )}
          {f.location.email && <div>📧 {f.location.email}</div>}
          <div className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
            Due: {new Date(f.due_date).toLocaleDateString('en-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {isOverdue && ' — Overdue'}
          </div>
          {f.location.sales_rep && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-gray-400">👤</span>
              <span className="font-semibold text-gray-700">{f.location.sales_rep}</span>
            </div>
          )}
        </div>

        {/* Previous notes */}
        {f.notes && (
          <div className="text-xs text-gray-600 italic bg-gray-50 rounded p-2">
            Last note: {f.notes}
          </div>
        )}

        {/* Actions */}
        {f.status === 'pending' && (
          <div className="flex flex-col gap-2">
            {/* Primary contact buttons */}
            <div className="flex gap-2">
              {f.whatsapp_number && !landline ? (
                <button
                  onClick={() => { setSelected(f); setShowMessage(true); }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg text-sm transition flex items-center justify-center gap-1.5"
                >
                  💬 WhatsApp
                </button>
              ) : null}
              {f.location.email ? (
                <button
                  onClick={() => { setSelected(f); setShowMessage(true); }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm transition flex items-center justify-center gap-1.5"
                >
                  📧 Email
                </button>
              ) : null}
              {!f.whatsapp_number && !f.location.email && (
                <button
                  onClick={() => { setSelected(f); setShowMessage(true); }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg text-sm transition"
                >
                  Copy Message
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setSelected(f); setShowModal(true); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1.5 rounded-lg text-xs transition"
              >
                Log Contact
              </button>
              <button
                onClick={() => setSnoozeId(f.location_id)}
                className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold py-1.5 rounded-lg text-xs transition border border-amber-200"
              >
                Not Now
              </button>
              <button
                onClick={() => setConvertId(f.location_id)}
                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-1.5 rounded-lg text-xs transition border border-blue-200"
              >
                Convert to Active
              </button>
            </div>
          </div>
        )}

        {f.status !== 'pending' && (
          <div className="text-[11px] text-gray-400 font-semibold uppercase flex justify-between border-t pt-2">
            <span>Via: {f.sent_via || '—'}</span>
            <span>{f.sent_date ? new Date(f.sent_date).toLocaleDateString() : '—'}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Follow-ups</h1>
        <p className="text-sm text-gray-500 mt-1">Your daily sales calls — leads only</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'today', label: `Today (${today.length})`, urgent: today.length > 0 },
          { key: 'pending', label: `Upcoming (${upcoming.length})` },
          { key: 'done', label: `Done (${done.length})` },
          { key: 'visits', label: 'Visits' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === t.key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            } ${'urgent' in t && t.urgent && activeTab !== t.key ? 'text-red-600' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Visits tab */}
      {activeTab === 'visits' && (
        visitsLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : visitsError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600 text-sm">
            Error: {visitsError}
          </div>
        ) : visits.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            No visits recorded yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Rep</th>
                  <th className="px-4 py-3">Visited</th>
                  <th className="px-4 py-3">Interest</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visits.map(v => (
                  <tr key={v.location_id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{v.restaurant_name}</div>
                      {v.phone && <div className="text-xs text-gray-400 mt-0.5">{v.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{v.contact_person || '—'}</div>
                      {v.email && <div className="text-xs text-gray-400 mt-0.5">{v.email}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {v.sales_rep ? (
                        <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">{v.sales_rep}</span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {parseVisitDate(v.visited_at)
                        ? parseVisitDate(v.visited_at)!.toLocaleDateString('en-DE', { day: 'numeric', month: 'short', year: 'numeric' })
                        : v.visited_at || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {v.interest_level ? (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize ${INTEREST_COLORS[v.interest_level.toLowerCase()] || 'bg-gray-100 text-gray-500'}`}>
                          {v.interest_level}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {v.pipeline_stage ? (
                        <span className="text-xs text-gray-600 capitalize">
                          {STAGE_LABELS[v.pipeline_stage] || v.pipeline_stage}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="text-xs text-gray-500 line-clamp-2">{v.notes || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Follow-ups content */}
      {activeTab !== 'visits' && (
        loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          {activeTab === 'today' ? 'Nothing due today. Check Upcoming.' : 'Nothing here.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayed.map(f => <Card key={f.id} f={f} />)}
        </div>
      ))}

      {/* Message Modal — shows pre-written WhatsApp message */}
      {showMessage && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.message_title}</h2>
                <p className="text-xs text-gray-500">{selected.location.name}</p>
              </div>
              <button onClick={() => { setShowMessage(false); setSelected(null); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Message preview */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                {selected.message_text}
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => navigator.clipboard.writeText(selected.message_text)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm transition"
                >
                  Copy
                </button>
                {selected.whatsapp_number && !isLandline(selected.whatsapp_number || selected.location.phone) && (
                  <button
                    onClick={() => openWhatsApp(selected)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg text-sm transition"
                  >
                    💬 WhatsApp ↗
                  </button>
                )}
                {selected.location.email && (
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent('Belarro Microgreens');
                      const body = encodeURIComponent(selected.message_text);
                      window.open(`mailto:${selected.location.email}?subject=${subject}&body=${body}`, '_blank');
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm transition"
                  >
                    📧 Email ↗
                  </button>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 mb-3">After sending, log it as done:</p>
                <div className="flex gap-2">
                  <select
                    value={logForm.sent_via}
                    onChange={e => setLogForm({ ...logForm, sent_via: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="email">📧 Email</option>
                    <option value="call">📞 Call</option>
                    <option value="visit">📍 Visit</option>
                  </select>
                  <button
                    onClick={handleLog as any}
                    disabled={submitting}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                  >
                    {submitting ? 'Saving...' : 'Mark Sent'}
                  </button>
                </div>
                <textarea
                  value={logForm.notes}
                  onChange={e => setLogForm({ ...logForm, notes: e.target.value })}
                  placeholder="Any notes? (optional)"
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none h-16 resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Contact Modal (for non-WhatsApp logging) */}
      {showModal && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-gray-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Log Contact</h2>
              <button onClick={() => { setShowModal(false); setSelected(null); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <form onSubmit={handleLog} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">How did you contact them?</label>
                <select
                  value={logForm.sent_via}
                  onChange={e => setLogForm({ ...logForm, sent_via: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="email">📧 Email</option>
                  <option value="call">📞 Call</option>
                  <option value="visit">📍 Visit</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (what did they say?)</label>
                <textarea
                  value={logForm.notes}
                  onChange={e => setLogForm({ ...logForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none"
                  placeholder="e.g. Chef loved the radish, wants to try sunflower next."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setSelected(null); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm shadow">
                  {submitting ? 'Saving...' : 'Mark Done'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Snooze confirmation */}
      {snoozeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Not interested right now?</h2>
            <p className="text-sm text-gray-600 mb-4">Pause all follow-ups and remind you again in:</p>
            <div className="flex gap-2 mb-6">
              {[30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setSnoozeDays(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${snoozeDays === d ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-200 hover:border-amber-400'}`}
                >
                  {d} days
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSnoozeId(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={() => handleSnooze(snoozeId)}
                disabled={snoozing}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">
                {snoozing ? 'Saving...' : `Snooze ${snoozeDays} days`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snooze success toast */}
      {snoozeSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl z-50">
          Snoozed — will reappear on {new Date(snoozeSuccess).toLocaleDateString('en-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      )}

      {/* Convert to Active confirmation */}
      {convertId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Convert to Active Customer?</h2>
            <p className="text-sm text-gray-600 mb-6">
              This will move the lead to Active and close all their pending follow-ups. This means they're now ordering from you.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConvertId(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={() => handleConvertToActive(convertId)}
                disabled={converting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">
                {converting ? 'Converting...' : 'Yes, Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
