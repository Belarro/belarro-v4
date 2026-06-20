'use client';

import React, { useEffect, useState } from 'react';

interface OrderToSeed {
  id: string;
  customer_id: string;
  product_variant_id: string;
  quantity: number;
  expected_harvest_date: string;
  crop: {
    id: string;
    name_en: string;
    name_de: string;
  } | null;
  variant: {
    size_name: string;
  } | null;
  customer: {
    name: string;
  } | null;
}

interface ActiveBatch {
  id: string;
  crop_id: string;
  seeding_date: string;
  quantity_trays: number;
  batch_type: 'order' | 'sample';
  expected_harvest_date: string;
  crop: {
    name_en: string;
  };
}

export default function SeedingPage() {
  const [ordersToSeed, setOrdersToSeed] = useState<OrderToSeed[]>([]);
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([]);
  const [readyToHarvest, setReadyToHarvest] = useState<ActiveBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Harvest logging form
  const [selectedHarvestBatch, setSelectedHarvestBatch] = useState<ActiveBatch | null>(null);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [harvestForm, setHarvestForm] = useState({
    actual_yield_grams: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/seeding');
      const json = await res.json();
      if (json.success) {
        setOrdersToSeed(json.data.orders_to_seed || []);
        setActiveBatches(json.data.active_batches || []);
        setReadyToHarvest(json.data.ready_to_harvest || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSeedBatch = async (cropId: string, orderIds: string[], traysCount: number) => {
    try {
      const res = await fetch('/api/seeding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_id: cropId,
          seeding_date: new Date().toISOString().split('T')[0],
          quantity_trays: traysCount,
          batch_type: 'order',
          order_ids: orderIds
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHarvestBatch) return;

    try {
      // Find orders matching this crop variety to link fulfillment
      // We can grab the order IDs of orders that are in 'growing' status
      const ordersRes = await fetch('/api/orders');
      const ordersJson = await ordersRes.json();
      let growingOrderIds: string[] = [];
      if (ordersJson.success) {
        growingOrderIds = (ordersJson.data || [])
          .filter((o: any) => o.status === 'growing' && o.variant?.crop_id === selectedHarvestBatch.crop_id)
          .map((o: any) => o.id);
      }

      const res = await fetch('/api/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seeding_batch_id: selectedHarvestBatch.id,
          harvest_date: new Date().toISOString().split('T')[0],
          actual_yield_grams: parseFloat(harvestForm.actual_yield_grams) || 0,
          notes: harvestForm.notes,
          order_ids: growingOrderIds
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowHarvestModal(false);
        setSelectedHarvestBatch(null);
        setHarvestForm({ actual_yield_grams: '', notes: '' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Group pending orders by crop to let user seed them in batches
  const groupedOrders: Record<string, { crop: any, orders: OrderToSeed[], totalTrays: number }> = {};
  ordersToSeed.forEach(o => {
    if (!o.crop) return;
    if (!groupedOrders[o.crop.id]) {
      groupedOrders[o.crop.id] = {
        crop: o.crop,
        orders: [],
        totalTrays: 0
      };
    }
    groupedOrders[o.crop.id].orders.push(o);
    groupedOrders[o.crop.id].totalTrays += o.quantity;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Production & Seeding Workflows</h1>
        <p className="text-sm text-gray-500 mt-1">Deduct seeds on planting, log yields, and auto-allocate harvests</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT PANEL: SEEDING CORES */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <span>🌱</span> Seeding Dashboard (Today)
            </h2>
            
            {Object.keys(groupedOrders).length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No crops pending to seed today.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.values(groupedOrders).map(group => {
                  const seedsNeeded = group.totalTrays * 60; // 60g default
                  return (
                    <div key={group.crop.id} className="border border-gray-150 rounded-xl p-5 hover:bg-gray-50/50 transition">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg leading-tight">{group.crop.name_en}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{group.crop.name_de}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-50 text-green-700">
                            {group.totalTrays} Trays Needed
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 py-3 border-y border-gray-100">
                        <span>Requires: <strong>{seedsNeeded}g of Seeds</strong></span>
                        <span>Orders count: <strong>{group.orders.length}</strong></span>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => handleSeedBatch(group.crop.id, group.orders.map(o => o.id), group.totalTrays)}
                          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition shadow-sm"
                        >
                          Log {group.totalTrays} Trays Seeded
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Batches List */}
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Active Seeding Batches ({activeBatches.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs font-semibold border-b border-gray-100 uppercase">
                      <th className="pb-2">Variety</th>
                      <th className="pb-2 text-center">Trays</th>
                      <th className="pb-2 text-center">Seeded Date</th>
                      <th className="pb-2 text-right">Expected Harvest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {activeBatches.map(b => (
                      <tr key={b.id} className="text-gray-700">
                        <td className="py-2.5 font-medium">{b.crop.name_en}</td>
                        <td className="py-2.5 text-center font-semibold">{b.quantity_trays}</td>
                        <td className="py-2.5 text-center text-gray-500 text-xs">
                          {new Date(b.seeding_date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-xs text-gray-900">
                          {new Date(b.expected_harvest_date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {activeBatches.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-gray-400 text-xs">No active batches in progress.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: HARVEST RUN */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <span>🌾</span> Harvest logs (Ready)
            </h2>

            {readyToHarvest.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No active batches ready for harvest today.
              </div>
            ) : (
              <div className="space-y-4">
                {readyToHarvest.map(b => (
                  <div key={b.id} className="border border-gray-150 rounded-xl p-5 hover:bg-gray-50/50 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{b.crop.name_en}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Seeded: {new Date(b.seeding_date).toLocaleDateString()} ({b.quantity_trays} trays)</p>
                      </div>
                      <button
                        onClick={() => { setSelectedHarvestBatch(b); setShowHarvestModal(true); }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition shadow-sm"
                      >
                        Record Harvest
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Harvest Logging Modal */}
      {showHarvestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Record Harvest Weight</h2>
              <button onClick={() => setShowHarvestModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleLogHarvest} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Harvested weight (Grams) *</label>
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quality notes / observation</label>
                <textarea
                  value={harvestForm.notes}
                  onChange={e => setHarvestForm({ ...harvestForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none h-20 resize-none"
                  placeholder="e.g. Excellent root formation, high density."
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowHarvestModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow"
                >
                  Confirm Harvest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
