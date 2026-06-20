'use client';

import React, { useEffect, useState } from 'react';

interface Order {
  id: string;
  customer_id: string;
  product_variant_id: string;
  quantity: number;
  order_date: string;
  next_delivery_date: string;
  expected_harvest_date: string;
  status: 'pending_seed' | 'growing' | 'ready_harvest' | 'packed' | 'delivered' | 'partial_delivery' | 'cancelled';
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

interface OrderLine {
  crop_id: string;
  product_variant_id: string;
  quantity: string;
}

const emptyLine = (): OrderLine => ({ crop_id: '', product_variant_id: '', quantity: '1' });

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([emptyLine()]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      const json = await res.json();
      if (json.success) setOrders(json.data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const [custRes, cropRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/crops'),
      ]);
      const custJson = await custRes.json();
      const cropJson = await cropRes.json();
      if (custJson.success) setCustomers(custJson.data || []);
      if (cropJson.success) setCrops(cropJson.data || []);
    } catch (err) {
      console.error('Failed to load resources:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchResources();
  }, []);

  const updateLine = (i: number, field: keyof OrderLine, value: string) => {
    setLines(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'crop_id') next[i].product_variant_id = '';
      return next;
    });
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validLines = lines.filter(l => l.product_variant_id);
      for (const line of validLines) {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customerId,
            product_variant_id: line.product_variant_id,
            quantity: parseFloat(line.quantity) || 1,
            recurring: true,
          }),
        });
      }
      setShowModal(false);
      setCustomerId('');
      setLines([emptyLine()]);
      fetchOrders();
    } catch (err) {
      console.error('Failed to create order:', err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this order?')) {
      try {
        const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) fetchOrders();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredOrders = activeFilter === 'all' ? orders : orders.filter(o => o.status === activeFilter);

  const statuses = [
    { key: 'all', label: 'All Orders' },
    { key: 'pending_seed', label: 'Pending Seed' },
    { key: 'growing', label: 'Growing' },
    { key: 'ready_harvest', label: 'Ready Harvest' },
    { key: 'delivered', label: 'Delivered' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Order Fulfillment</h1>
          <p className="text-sm text-gray-500 mt-1">Track crop orders, harvest calculations, and deliveries</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-lg shadow transition"
        >
          + New Order
        </button>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        {statuses.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveFilter(s.key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
              activeFilter === s.key
                ? 'border-green-600 text-green-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No orders matching this filter.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-100 text-xs uppercase font-semibold">
                <th className="p-4">Customer</th>
                <th className="p-4">Product</th>
                <th className="p-4 text-center">Qty</th>
                <th className="p-4">Est. Seeding</th>
                <th className="p-4">Est. Harvest</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map(o => {
                const totalGrams = o.variant ? o.quantity * o.variant.size_grams : 0;
                return (
                  <tr key={o.id} className="text-gray-700 hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{o.customer.name}</td>
                    <td className="p-4">
                      {o.variant ? (
                        <div>
                          <div className="font-semibold text-gray-900">{o.variant.crop.name_en}</div>
                          <div className="text-xs text-gray-400">{o.variant.size_name} · {totalGrams}g</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-4 text-center font-bold text-gray-900">{o.quantity}</td>
                    <td className="p-4 text-gray-500">
                      {o.expected_harvest_date
                        ? new Date(new Date(o.expected_harvest_date).setDate(new Date(o.expected_harvest_date).getDate() - 10)).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-4 font-semibold text-gray-900">
                      {o.expected_harvest_date ? new Date(o.expected_harvest_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                        o.status === 'delivered' ? 'bg-green-50 text-green-600' :
                        o.status === 'growing' ? 'bg-blue-50 text-blue-600' :
                        o.status === 'ready_harvest' ? 'bg-amber-50 text-amber-600' :
                        'bg-purple-50 text-purple-600'
                      }`}>
                        {o.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {o.status === 'pending_seed' && (
                        <button onClick={() => handleUpdateStatus(o.id, 'growing')}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded text-xs border border-blue-200">
                          Grow
                        </button>
                      )}
                      {o.status === 'growing' && (
                        <button onClick={() => handleUpdateStatus(o.id, 'ready_harvest')}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded text-xs border border-amber-200">
                          Ready
                        </button>
                      )}
                      {o.status === 'ready_harvest' && (
                        <button onClick={() => handleUpdateStatus(o.id, 'delivered')}
                          className="bg-green-50 hover:bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded text-xs border border-green-200">
                          Deliver
                        </button>
                      )}
                      <button onClick={() => handleDelete(o.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded text-xs border border-red-200">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create Order</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer *</label>
                <select
                  required
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="">Select Customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-600">Order Lines *</label>
                {lines.map((line, i) => {
                  const cropVariants = crops.find(c => c.id === line.crop_id)?.variants || [];
                  return (
                    <div key={i} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1 space-y-2">
                        <select
                          required
                          value={line.crop_id}
                          onChange={e => updateLine(i, 'crop_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
                        >
                          <option value="">Select Crop...</option>
                          {crops.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
                        </select>
                        {line.crop_id && (
                          <select
                            required
                            value={line.product_variant_id}
                            onChange={e => updateLine(i, 'product_variant_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
                          >
                            <option value="">Select Size...</option>
                            {cropVariants.map((v) => (
                              <option key={v.id} value={v.id}>{v.size_name} (€{v.price_eur?.toFixed(2) ?? '0.00'})</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="w-16">
                        <input
                          type="number"
                          min="1"
                          required
                          value={line.quantity}
                          onChange={e => updateLine(i, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-green-500 outline-none bg-white"
                        />
                      </div>
                      {lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(i)}
                          className="text-red-400 hover:text-red-600 font-bold text-lg leading-none mt-2">
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addLine}
                  className="text-green-600 hover:text-green-700 text-sm font-semibold flex items-center gap-1"
                >
                  + Add another crop
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
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
