'use client';

import React, { useEffect, useState } from 'react';

interface ScheduleItem {
  crop_name: string;
  grow_days: number;
  seed_date: string;
  seed_display: string;
  seed_day: 'Tuesday' | 'Friday';
  order_qty: number;
  size_name: string;
  size_grams: number;
  crop_id: string;
  customer_name: string;
  harvest_display: string;
}

interface DeliveryGroup {
  harvest_date: string;
  harvest_display: string;
  customer_name: string;
  items: ScheduleItem[];
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
  schedule: DeliveryGroup[];
  seed_today: ScheduleItem[];
  seed_tuesday: ScheduleItem[];
  seed_friday: ScheduleItem[];
  active_batches: ActiveBatch[];
  ready_to_harvest: ActiveBatch[];
  today: string;
  next_tuesday: string;
  next_friday: string;
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function SeedCard({ items, label, dateStr, isToday }: { items: ScheduleItem[]; label: string; dateStr: string; isToday: boolean }) {
  if (items.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold text-gray-500">{label}</span>
        {isToday && <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full">TODAY</span>}
      </div>
      <p className="text-xs text-gray-400">{fmt(dateStr)} — Nothing to seed</p>
    </div>
  );

  return (
    <div className={`bg-white border rounded-xl p-5 space-y-4 ${isToday ? 'border-green-400 shadow-md' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{label}</span>
            {isToday && <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full">TODAY</span>}
          </div>
          <p className="text-xs text-gray-500">{fmt(dateStr)}</p>
        </div>
        <span className="text-2xl font-extrabold text-green-600">{items.length} <span className="text-sm font-normal text-gray-500">items</span></span>
      </div>

      <div className="divide-y divide-gray-100">
        {items.map((item, i) => (
          <div key={i} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900 text-sm">{item.crop_name}</div>
              <div className="text-xs text-gray-500">
                {item.grow_days}d grow → harvest {item.harvest_display} · {item.customer_name}
              </div>
            </div>
            <div className="text-right font-bold text-gray-900">
              {item.order_qty}× <span className="text-xs font-normal text-gray-500">{item.size_name || `${item.size_grams}g`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductionPage() {
  const [data, setData] = useState<ProductionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'schedule' | 'active' | 'harvest'>('schedule');

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

  const today = data?.today || '';
  const isThisTuesdayToday = data?.next_tuesday === today;
  const isThisFridayToday = data?.next_friday === today;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Production</h1>
        <p className="text-sm text-gray-500 mt-1">Seed on Tuesday (10+ day varieties) and Friday (under 10 days). All orders in a delivery harvest together on Tuesday.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'schedule', label: 'Seeding Schedule' },
          { key: 'active', label: `Growing (${data?.active_batches.length ?? 0})` },
          { key: 'harvest', label: `Ready to Harvest (${data?.ready_to_harvest.length ?? 0})`, urgent: (data?.ready_to_harvest.length ?? 0) > 0 },
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
          {/* SEEDING SCHEDULE TAB */}
          {activeTab === 'schedule' && data && (
            <div className="space-y-6">
              {/* This week's seed days */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SeedCard
                  items={data.seed_tuesday}
                  label="Tuesday Seeding"
                  dateStr={data.next_tuesday}
                  isToday={isThisTuesdayToday}
                />
                <SeedCard
                  items={data.seed_friday}
                  label="Friday Seeding"
                  dateStr={data.next_friday}
                  isToday={isThisFridayToday}
                />
              </div>

              {/* Full delivery schedule */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Upcoming Deliveries</h2>
                {data.schedule.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
                    No active orders. Add orders to see the seeding schedule.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.schedule.map((delivery) => (
                      <div key={delivery.harvest_date} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        {/* Delivery header */}
                        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-gray-900">Harvest & Deliver: {delivery.harvest_display}</span>
                            <span className="ml-3 text-sm text-gray-500">{delivery.customer_name}</span>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg">
                            {delivery.items.length} items
                          </span>
                        </div>

                        {/* Items */}
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                              <th className="px-5 py-2 text-left">Variety</th>
                              <th className="px-5 py-2 text-left">Grow Days</th>
                              <th className="px-5 py-2 text-left">Seed On</th>
                              <th className="px-5 py-2 text-left">Seed Day</th>
                              <th className="px-5 py-2 text-right">Order</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {delivery.items.map((item, i) => {
                              const isSeedDay = item.seed_date === data.next_tuesday || item.seed_date === data.next_friday;
                              const isSeedToday = item.seed_date === today;
                              return (
                                <tr key={i} className={isSeedToday ? 'bg-green-50' : isSeedDay ? 'bg-amber-50' : ''}>
                                  <td className="px-5 py-3 font-semibold text-gray-900">{item.crop_name}</td>
                                  <td className="px-5 py-3 text-gray-600">{item.grow_days}d</td>
                                  <td className="px-5 py-3 text-gray-900 font-medium">
                                    {item.seed_display}
                                    {isSeedToday && <span className="ml-2 text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded">TODAY</span>}
                                    {isSeedDay && !isSeedToday && <span className="ml-2 text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">THIS WEEK</span>}
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                      item.seed_day === 'Tuesday' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                    }`}>
                                      {item.seed_day}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                                    {item.order_qty}× <span className="text-xs font-normal text-gray-500">{item.size_name || `${item.size_grams}g`}</span>
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
              </div>
            </div>
          )}

          {/* GROWING TAB */}
          {activeTab === 'active' && (
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
                        <th className="px-5 py-3 text-left">Expected Harvest</th>
                        <th className="px-5 py-3 text-left">Days Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(data?.active_batches || []).map(b => {
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
                                {daysLeft <= 0 ? 'Ready now' : `${daysLeft}d`}
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

          {/* HARVEST TAB */}
          {activeTab === 'harvest' && (
            <div>
              {!data || data.ready_to_harvest.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
                  Nothing ready to harvest yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(data?.ready_to_harvest || []).map(b => (
                    <div key={b.id} className="bg-white border border-amber-300 rounded-xl p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-gray-900 text-base">{b.crop.name_en}</div>
                          <div className="text-xs text-gray-500">{b.crop.name_de}</div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">Ready</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Seeded: {new Date(b.seeding_date).toLocaleDateString()}</div>
                        <div>Trays: <span className="font-bold">{b.quantity_trays}</span></div>
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
                  type="number"
                  required
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
                  placeholder="Quality notes..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setHarvestModal(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm shadow">
                  {submitting ? 'Saving...' : 'Confirm Harvest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
