'use client';

import React, { useEffect, useState } from 'react';

interface FollowUp {
  id: string;
  customer_id: string;
  follow_up_number: number;
  follow_up_days: number;
  due_date: string;
  status: 'pending' | 'sent' | 'completed';
  sent_via: 'whatsapp' | 'email' | 'call' | 'visit' | null;
  sent_date: string | null;
  notes: string | null;
  customer: {
    name: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
}

export default function FollowUpsPage() {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const [selectedFollowup, setSelectedFollowup] = useState<FollowUp | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({
    sent_via: 'whatsapp' as 'whatsapp' | 'email' | 'call' | 'visit',
    notes: ''
  });
  const [deleteTarget, setDeleteTarget] = useState<FollowUp | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFollowups = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/follow-ups');
      const json = await res.json();
      if (json.success) {
        setFollowups(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, []);

  const handleLogFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowup) return;

    try {
      const res = await fetch(`/api/follow-ups/${selectedFollowup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          sent_via: logForm.sent_via,
          notes: logForm.notes
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowLogModal(false);
        setSelectedFollowup(null);
        setLogForm({ sent_via: 'whatsapp', notes: '' });
        fetchFollowups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/follow-ups/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchFollowups();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = followups
    .filter(f => {
      if (activeTab === 'pending') return f.status === 'pending';
      return f.status === 'completed' || f.status === 'sent';
    })
    .sort((a, b) => {
      if (activeTab === 'pending') {
        // Overdue first, then soonest due date
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else {
        // Most recently completed on top
        const aDate = a.sent_date ? new Date(a.sent_date).getTime() : 0;
        const bDate = b.sent_date ? new Date(b.sent_date).getTime() : 0;
        return bDate - aDate;
      }
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Customer Follow-ups</h1>
        <p className="text-sm text-gray-500 mt-1">Track the 5-stage automated sales followups (Days 0, 3, 7, 14, 30)</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'pending' 
              ? 'border-green-600 text-green-700 font-bold' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Pending ({followups.filter(f => f.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'completed' 
              ? 'border-green-600 text-green-700 font-bold' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Completed ({followups.filter(f => f.status === 'completed' || f.status === 'sent').length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No follow-ups found in this section.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(f => {
            const isOverdue = activeTab === 'pending' && new Date(f.due_date) < new Date();
            return (
              <div 
                key={f.id} 
                className={`bg-white border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition ${
                  isOverdue ? 'border-red-200 bg-red-50/10' : 'border-gray-200'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-900 text-base">{f.customer.name}</h3>
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full ${
                      f.follow_up_number === 1 ? 'bg-purple-100 text-purple-700' :
                      f.follow_up_number === 2 ? 'bg-blue-100 text-blue-700' :
                      f.follow_up_number === 3 ? 'bg-teal-100 text-teal-700' :
                      f.follow_up_number === 4 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      Stage {f.follow_up_number} (Day {f.follow_up_days})
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-gray-500 space-y-1.5 border-t border-gray-100 pt-3">
                    {f.customer.phone && <div>📞 {f.customer.phone}</div>}
                    {f.customer.email && <div className="truncate">📧 {f.customer.email}</div>}
                    <div className="mt-2 text-[11px]">
                      Due: <strong className={isOverdue ? 'text-red-600' : 'text-gray-700'}>
                        {new Date(f.due_date).toLocaleDateString()} {isOverdue && '(Overdue)'}
                      </strong>
                    </div>
                  </div>

                  {f.notes && (
                    <div className="mt-4 p-2.5 rounded bg-gray-50 text-xs text-gray-600 italic">
                      Notes: {f.notes}
                    </div>
                  )}
                </div>

                {activeTab === 'pending' ? (
                  <div className="mt-6 flex gap-2">
                    <button
                      onClick={() => { setSelectedFollowup(f); setShowLogModal(true); }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg text-xs transition"
                    >
                      Log Follow-up Sent
                    </button>
                    <button
                      onClick={() => setDeleteTarget(f)}
                      className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase flex gap-4">
                      <span>Sent via: {f.sent_via}</span>
                      <span>Date: {f.sent_date ? new Date(f.sent_date).toLocaleDateString() : '—'}</span>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(f)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-red-600 mb-2">Delete follow-up?</h2>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete the follow-up for <strong>{deleteTarget.customer.name}</strong>. Cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Log Customer Contact</h2>
              <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleLogFollowup} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Channel *</label>
                <select
                  required
                  value={logForm.sent_via}
                  onChange={e => setLogForm({ ...logForm, sent_via: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="whatsapp">💬 WhatsApp Message</option>
                  <option value="email">📧 Email Client</option>
                  <option value="call">📞 Phone Call</option>
                  <option value="visit">📍 Personal Sales Visit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up Notes / Outcomes</label>
                <textarea
                  value={logForm.notes}
                  onChange={e => setLogForm({ ...logForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none"
                  placeholder="e.g. Chef requested microgreen samples. Sending this Friday."
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow"
                >
                  Log Sent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
