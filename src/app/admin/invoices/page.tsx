'use client';

import React, { useEffect, useState } from 'react';

interface Invoice {
  id: string;
  customer_id: string;
  invoice_month: string;
  total_amount_eur: number;
  vat_amount_eur: number;
  status: 'draft' | 'sent' | 'paid';
  customer: {
    name: string;
  };
}

interface Customer {
  id: string;
  name: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_month: '2026-06',
    total_amount_eur: '',
    status: 'draft' as 'draft' | 'sent' | 'paid'
  });

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/invoices');
      const json = await res.json();
      if (json.success) {
        setInvoices(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const json = await res.json();
      if (json.success) {
        setCustomers(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        fetchInvoices();
        setFormData({ customer_id: '', invoice_month: '2026-06', total_amount_eur: '', status: 'draft' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'draft' | 'sent' | 'paid') => {
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        fetchInvoices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Billing & Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Generate chef statements, log VAT sums, and manage payment statuses</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-lg shadow transition"
        >
          + Create Invoice Record
        </button>
      </div>

      {/* Lists */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No billing logs recorded yet.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold">
                <th className="p-4">Customer Account</th>
                <th className="p-4">Billing Month</th>
                <th className="p-4 text-center">VAT Amount (7%)</th>
                <th className="p-4 text-center">Total Amount (EUR)</th>
                <th className="p-4 text-center">Payment Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="p-4 font-semibold text-gray-900">{i.customer.name}</td>
                  <td className="p-4 text-gray-600 font-medium">{i.invoice_month}</td>
                  <td className="p-4 text-center text-gray-500 font-semibold">
                    €{i.vat_amount_eur ? i.vat_amount_eur.toFixed(2) : '0.00'}
                  </td>
                  <td className="p-4 text-center font-bold text-gray-900">
                    €{i.total_amount_eur ? i.total_amount_eur.toFixed(2) : '0.00'}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                      i.status === 'paid' ? 'bg-green-50 text-green-600' :
                      i.status === 'sent' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'
                    }`}>
                      {i.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {i.status === 'draft' && (
                      <button
                        onClick={() => handleUpdateStatus(i.id, 'sent')}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded text-xs border border-blue-200"
                      >
                        Mark Sent
                      </button>
                    )}
                    {i.status === 'sent' && (
                      <button
                        onClick={() => handleUpdateStatus(i.id, 'paid')}
                        className="bg-green-50 hover:bg-green-100 text-green-700 font-semibold px-2 py-1 rounded text-xs border border-green-200"
                      >
                        Mark Paid
                      </button>
                    )}
                    <button
                      onClick={() => window.print()}
                      className="bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold px-2 py-1 rounded text-xs border border-gray-200"
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create Invoice Log</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="">Select Customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Billing Month *</label>
                <input
                  type="month"
                  required
                  value={formData.invoice_month}
                  onChange={e => setFormData({ ...formData, invoice_month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Total Amount (EUR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.total_amount_eur}
                  onChange={e => setFormData({ ...formData, total_amount_eur: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g. 150.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow"
                >
                  Log Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
