'use client';

import React, { useEffect, useState } from 'react';

interface SeedItem {
  crop_name: string;
  trays_needed: number | null;
  seed_date: string;
  seed_day: string;
  harvest_display: string;
}

interface DeliveryItem {
  crop_name: string;
  order_qty: number;
  size_name: string;
  size_grams: number;
  trays_needed: number | null;
}

interface DeliveryGroup {
  harvest_date: string;
  harvest_display: string;
  customer_name: string;
  items: DeliveryItem[];
}

interface ActiveBatch {
  id: string;
  crop_id: string;
  seeding_date: string;
  quantity_trays: number;
  expected_harvest_date: string;
  crop: { name_en: string; name_de: string };
}

interface ProductionData {
  schedule: {
    harvest_date: string;
    harvest_display: string;
    customer_name: string;
    items: any[];
  }[];
  seed_tuesday: any[];
  seed_friday: any[];
  active_batches: ActiveBatch[];
  ready_to_harvest: ActiveBatch[];
  today: string;
  next_tuesday: string;
  next_friday: string;
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ProductionPage() {
  const [data, setData] = useState<ProductionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'seeding' | 'delivery' | 'growing' | 'harvest'>('seeding');

  const [harvestModal, setHarvestModal] = useState<ActiveBatch | null>(null);
  const [harvestForm, setHarvestForm] = useState({ actual_yield_grams: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/production');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleLogHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!harvestModal || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seeding_batch_id: harvestModal.id,
          harvest_date: new Date().toISOString().split('T')[0],
          actual_yield_grams: parseFloat(harvestForm.actual_yield_grams) || 0,
          notes: harvestForm.notes,
          order_ids: [],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setHarvestModal(null);
        setHarvestForm({ actual_yield_grams: '', notes: '' });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Deduplicate seed items by crop for a given seed day
  const deduplicateByTray = (items: any[]): { crop_name: string; trays: number }[] => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = item.crop_name;
      map.set(key, (map.get(key) || 0) + (item.quantity_trays || item.trays_needed || 1));
    }
    return Array.from(map.entries()).map(([crop_name, trays]) => ({ crop_name, trays }));
  };

  const tuesdayItems = deduplicateByTray(data?.seed_tuesday || []);
  const fridayItems = deduplicateByTray(data?.seed_friday || []);

  // Group deliveries by harvest date
  const deliveries = data?.schedule || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Production</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'seeding', label: 'Seeding' },
          { key: 'delivery', label: 'Delivery' },
          { key: 'growing', label: `Growing (${data?.active_batches.length ?? 0})` },
          { key: 'harvest', label: `Harvest (${data?.ready_to_harvest.length ?? 0})`, urgent: (data?.ready_to_harvest.length ?? 0) > 0 },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === t.key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-900'
            } ${t.urgent && activeTab !== t.key ? 'text-amber-600' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      ) : (
        <>
          {/* ── SEEDING TAB ── */}
          {activeTab === 'seeding' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Tuesday */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-blue-50 border-b border-blue-100 px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">Tuesday Seeding</div>
                    <div className="text-xs text-gray-500">{data?.next_tuesday ? fmt(data.next_tuesday) : ''} — long cycle (10+ days)</div>
                  </div>
                  {tuesdayItems.length > 0 && (
                    <span className="text-2xl font-extrabold text-blue-600">
                      {tuesdayItems.reduce((s, i) => s + i.trays, 0)}
                      <span className="text-sm font-normal text-gray-500 ml-1">trays</span>
                    </span>
                  )}
                </div>
                {tuesdayItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Nothing to seed this Tuesday</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                        <th className="px-5 py-2 text-left">Variety</th>
                        <th className="px-5 py-2 text-right">Trays</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {tuesdayItems.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-semibold text-gray-900">{item.crop_name}</td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900">{item.trays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Friday */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-purple-50 border-b border-purple-100 px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">Friday Seeding</div>
                    <div className="text-xs text-gray-500">{data?.next_friday ? fmt(data.next_friday) : ''} — short cycle (under 10 days)</div>
                  </div>
                  {fridayItems.length > 0 && (
                    <span className="text-2xl font-extrabold text-purple-600">
                      {fridayItems.reduce((s, i) => s + i.trays, 0)}
                      <span className="text-sm font-normal text-gray-500 ml-1">trays</span>
                    </span>
                  )}
                </div>
                {fridayItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Nothing to seed this Friday</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                        <th className="px-5 py-2 text-left">Variety</th>
                        <th className="px-5 py-2 text-right">Trays</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {fridayItems.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-semibold text-gray-900">{item.crop_name}</td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900">{item.trays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── DELIVERY TAB ── */}
          {activeTab === 'delivery' && (
            <div className="space-y-4">
              {deliveries.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
                  No upcoming deliveries.
                </div>
              ) : (
                deliveries.map((delivery) => (
                  <div key={delivery.harvest_date + delivery.customer_name} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900">{delivery.customer_name}</span>
                        <span className="ml-3 text-sm text-gray-500">Delivery: {delivery.harvest_display}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg">
                        {delivery.items.length} items
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                          <th className="px-5 py-2 text-left">Variety</th>
                          <th className="px-5 py-2 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {delivery.items.map((item: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-semibold text-gray-900">{item.crop_name}</td>
                            <td className="px-5 py-3 text-right text-gray-700">
                              {item.order_qty}× <span className="text-xs text-gray-500">{item.size_name || `${item.size_grams}g`}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── GROWING TAB ── */}
          {activeTab === 'growing' && (
            <div>
              {!data || data.active_batches.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
                  No active batches in the ground.
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-5 py-3 text-left">Variety</th>
                        <th className="px-5 py-3 text-center">Trays</th>
                        <th className="px-5 py-3 text-left">Seeded</th>
                        <th className="px-5 py-3 text-left">Harvest</th>
                        <th className="px-5 py-3 text-left">Days Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.active_batches.map(b => {
                        const harvestDate = new Date(b.expected_harvest_date);
                        const daysLeft = Math.ceil((harvestDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return (
                          <tr key={b.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-semibold text-gray-900">{b.crop.name_en}</td>
                            <td className="px-5 py-3 text-center font-bold">{b.quantity_trays}</td>
                            <td className="px-5 py-3 text-gray-600">{new Date(b.seeding_date).toLocaleDateString()}</td>
                            <td className="px-5 py-3 font-semibold">{harvestDate.toLocaleDateString('en-DE', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                daysLeft <= 0 ? 'bg-red-100 text-red-700' :
                                daysLeft <= 3 ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {daysLeft <= 0 ? 'Ready' : `${daysLeft}d`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── HARVEST TAB ── */}
          {activeTab === 'harvest' && (
            <div>
              {!data || data.ready_to_harvest.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
                  Nothing ready to harvest yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.ready_to_harvest.map(b => (
                    <div key={b.id} className="bg-white border border-amber-300 rounded-xl p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-gray-900 text-base">{b.crop.name_en}</div>
                          <div className="text-xs text-gray-500">{b.quantity_trays} trays · seeded {new Date(b.seeding_date).toLocaleDateString()}</div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">Ready</span>
                      </div>
                      <button
                        onClick={() => setHarvestModal(b)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm transition"
                      >
                        Record Harvest
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Harvest Modal */}
      {harvestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-gray-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Record Harvest</h2>
                <p className="text-sm text-gray-500">{harvestModal.crop.name_en} — {harvestModal.quantity_trays} trays</p>
              </div>
              <button onClick={() => setHarvestModal(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <form onSubmit={handleLogHarvest} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Actual yield (grams)</label>
                <input
                  type="number" required
                  value={harvestForm.actual_yield_grams}
                  onChange={e => setHarvestForm({ ...harvestForm, actual_yield_grams: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g. 750"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
                <textarea
                  value={harvestForm.notes}
                  onChange={e => setHarvestForm({ ...harvestForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none h-20 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setHarvestModal(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">
                  {submitting ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
