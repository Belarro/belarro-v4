'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface OrderLine {
  id: string;
  customer_id: string;
  product_variant_id: string;
  quantity: number;
  expected_harvest_date: string;
  status: string;
  recurring: boolean;
  customer: { id: string; name: string; email: string };
  variant: {
    id: string;
    size_name: string;
    size_grams: number;
    price_eur: number;
    crop: { id: string; name_en: string; name_de: string };
  } | null;
}

interface Customer { id: string; name: string }
interface Crop {
  id: string;
  name_en: string;
  variants?: Array<{ id: string; size_name: string; price_eur: number }>;
}

interface NewLine { crop_id: string; product_variant_id: string; quantity: string }
const emptyLine = (): NewLine => ({ crop_id: '', product_variant_id: '', quantity: '1' });

const STATUS_COLORS: Record<string, string> = {
  pending_seed: 'bg-purple-50 text-purple-700',
  growing: 'bg-blue-50 text-blue-700',
  ready_harvest: 'bg-amber-50 text-amber-700',
  delivered: 'bg-green-50 text-green-700',
};

const NEXT_STATUS: Record<string, string> = {
  pending_seed: 'growing',
  growing: 'ready_harvest',
  ready_harvest: 'delivered',
};

const NEXT_LABEL: Record<string, string> = {
  pending_seed: 'Start Growing',
  growing: 'Ready to Harvest',
  ready_harvest: 'Mark Delivered',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderLine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add order modal state
  const [showModal, setShowModal] = useState(false);
  const [modalCustomerId, setModalCustomerId] = useState('');
  const [newLines, setNewLines] = useState<NewLine[]>([emptyLine()]);

  // Inline edit state: orderId -> new quantity
  const [editingQty, setEditingQty] = useState<Record<string, string>>({});

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      const json = await res.json();
      if (json.success) setOrders(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const [cRes, crRes] = await Promise.all([fetch('/api/customers'), fetch('/api/crops')]);
      const cJson = await cRes.json();
      const crJson = await crRes.json();
      if (cJson.success) setCustomers(cJson.data || []);
      if (crJson.success) setCrops(crJson.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchOrders(); fetchResources(); }, []);

  // Group orders by customer
  const grouped = useMemo(() => {
    const map = new Map<string, { customer: OrderLine['customer']; lines: OrderLine[] }>();
    for (const o of orders) {
      if (!o.customer) continue;
      if (!map.has(o.customer_id)) {
        map.set(o.customer_id, { customer: o.customer, lines: [] });
      }
      map.get(o.customer_id)!.lines.push(o);
    }
    return Array.from(map.values());
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.filter(g => g.customer.name.toLowerCase().includes(q));
  }, [grouped, search]);

  const handleAdvanceStatus = async (id: string, nextStatus: string) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchOrders();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this order line?')) return;
    await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    fetchOrders();
  };

  const handleSaveQty = async (id: string, customerId: string) => {
    const qty = parseFloat(editingQty[id]);
    if (!qty || qty < 1) return;
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty }),
    });
    setEditingQty(prev => { const n = { ...prev }; delete n[id]; return n; });
    fetchOrders();
  };

  // New order modal
  const updateNewLine = (i: number, field: keyof NewLine, value: string) => {
    setNewLines(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'crop_id') next[i].product_variant_id = '';
      return next;
    });
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = newLines.filter(l => l.product_variant_id);
    for (const line of validLines) {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: modalCustomerId,
          product_variant_id: line.product_variant_id,
          quantity: parseFloat(line.quantity) || 1,
          recurring: true,
        }),
      });
    }
    setShowModal(false);
    setModalCustomerId('');
    setNewLines([emptyLine()]);
    fetchOrders();
  };

  const openModalForCustomer = (customerId: string) => {
    setModalCustomerId(customerId);
    setNewLines([emptyLine()]);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">One card per customer — all their crops in one place</p>
        </div>
        <button
          onClick={() => { setModalCustomerId(''); setNewLines([emptyLine()]); setShowModal(true); }}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-lg shadow transition"
        >
          + New Order
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search customer..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
      />

      {/* Customer Cards */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          {search ? `No customer matching "${search}"` : 'No orders yet. Click + New Order to start.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ customer, lines }) => (
            <div key={customer.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-bold text-gray-900 text-base">{customer.name}</span>
                <button
                  onClick={() => openModalForCustomer(customer.id)}
                  className="text-green-600 hover:text-green-700 text-sm font-semibold"
                >
                  + Add Crop
                </button>
              </div>

              {/* Order Lines */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-400 font-semibold border-b border-gray-100">
                    <th className="px-5 py-2 text-left">Crop</th>
                    <th className="px-5 py-2 text-left">Size</th>
                    <th className="px-5 py-2 text-center">Qty</th>
                    <th className="px-5 py-2 text-left">Harvest</th>
                    <th className="px-5 py-2 text-center">Status</th>
                    <th className="px-5 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lines.map(line => {
                    const isEditing = editingQty[line.id] !== undefined;
                    const nextStatus = NEXT_STATUS[line.status];
                    return (
                      <tr key={line.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-semibold text-gray-900">
                          {line.variant?.crop.name_en ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {line.variant?.size_name ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={editingQty[line.id]}
                                onChange={e => setEditingQty(prev => ({ ...prev, [line.id]: e.target.value }))}
                                className="w-16 px-2 py-1 border border-green-400 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveQty(line.id, customer.id)}
                                className="text-green-600 hover:text-green-800 font-bold text-sm"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingQty(prev => { const n = { ...prev }; delete n[line.id]; return n; })}
                                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingQty(prev => ({ ...prev, [line.id]: String(line.quantity) }))}
                              className="font-bold text-gray-900 hover:text-green-600 hover:underline"
                              title="Click to edit quantity"
                            >
                              {line.quantity}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {line.expected_harvest_date
                            ? new Date(line.expected_harvest_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
                            : '—'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${STATUS_COLORS[line.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {line.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right space-x-2">
                          {nextStatus && (
                            <button
                              onClick={() => handleAdvanceStatus(line.id, nextStatus)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2.5 py-1 rounded text-xs border border-gray-200"
                            >
                              {NEXT_LABEL[line.status]}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(line.id)}
                            className="text-red-400 hover:text-red-600 font-semibold text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Order</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-6 space-y-5">
              {!modalCustomerId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Customer *</label>
                  <select
                    required
                    value={modalCustomerId}
                    onChange={e => setModalCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">Select Customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {modalCustomerId && (
                <p className="text-sm font-semibold text-gray-700">
                  Customer: <span className="text-green-700">{customers.find(c => c.id === modalCustomerId)?.name}</span>
                </p>
              )}

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-600">Crops *</label>
                {newLines.map((line, i) => {
                  const variants = crops.find(c => c.id === line.crop_id)?.variants || [];
                  return (
                    <div key={i} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1 space-y-2">
                        <select
                          required
                          value={line.crop_id}
                          onChange={e => updateNewLine(i, 'crop_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                        >
                          <option value="">Select Crop...</option>
                          {crops.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
                        </select>
                        {line.crop_id && (
                          <select
                            required
                            value={line.product_variant_id}
                            onChange={e => updateNewLine(i, 'product_variant_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                          >
                            <option value="">Select Size...</option>
                            {variants.map(v => (
                              <option key={v.id} value={v.id}>{v.size_name} (€{v.price_eur?.toFixed(2) ?? '0.00'})</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        required
                        value={line.quantity}
                        onChange={e => updateNewLine(i, 'quantity', e.target.value)}
                        className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm text-center bg-white focus:ring-2 focus:ring-green-500 outline-none"
                      />
                      {newLines.length > 1 && (
                        <button type="button" onClick={() => setNewLines(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-600 font-bold text-lg mt-1">×</button>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => setNewLines(prev => [...prev, emptyLine()])}
                  className="text-green-600 hover:text-green-700 text-sm font-semibold">
                  + Add another crop
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-2 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow">
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
