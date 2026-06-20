'use client';

import React, { useEffect, useState } from 'react';

interface SeedInventory {
  id: string;
  crop_id: string;
  quantity_grams: number;
  reorder_threshold_trays: number;
  crop: {
    name_en: string;
    name_de: string;
  };
}

interface PackageInventory {
  id: string;
  variant_id: string;
  quantity_available: number;
  reorder_threshold: number;
  variant: {
    size_name: string;
    crop: {
      name_en: string;
    } | null;
  } | null;
}

interface SampleInventory {
  id: string;
  crop_id: string;
  available_grams: number;
  crop: {
    name_en: string;
  };
}

export default function InventoryPage() {
  const [seeds, setSeeds] = useState<SeedInventory[]>([]);
  const [packages, setPackages] = useState<PackageInventory[]>([]);
  const [samples, setSamples] = useState<SampleInventory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'seeds' | 'packages' | 'samples'>('seeds');

  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>('');

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (json.success) {
        setSeeds(json.data.seeds || []);
        setPackages(json.data.packages || []);
        setSamples(json.data.samples || []);
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleSaveQty = async (type: 'seeds' | 'packages' | 'samples', id: string) => {
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          id,
          quantity: parseFloat(editQty) || 0
        })
      });
      const json = await res.json();
      if (json.success) {
        setEditId(null);
        fetchInventory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Farm Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Manage seed stocks, boxes/containers, and sample materials</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['seeds', 'packages', 'samples'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setEditId(null); }}
            className={`px-6 py-3 text-sm font-semibold border-b-2 capitalize transition ${
              activeTab === tab 
                ? 'border-green-600 text-green-700 font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab} Stock
          </button>
        ))}
      </div>

      {/* Tables */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          
          {/* SEEDS TABLE */}
          {activeTab === 'seeds' && (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold">
                  <th className="p-4">Crop / Seed Type</th>
                  <th className="p-4 text-center">Remaining Stock (Grams)</th>
                  <th className="p-4 text-center">Approx. Trays Ready</th>
                  <th className="p-4 text-center">Reorder Threshold</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seeds.map(s => {
                  const remainingTrays = Math.floor(s.quantity_grams / 60); // Assuming 60g per tray
                  const isLow = remainingTrays < s.reorder_threshold_trays;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-4 font-semibold text-gray-900">{s.crop.name_en}</td>
                      <td className="p-4 text-center">
                        {editId === s.id ? (
                          <input
                            type="number"
                            value={editQty}
                            onChange={e => setEditQty(e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-center outline-none focus:ring-2 focus:ring-green-500"
                          />
                        ) : (
                          <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                            {s.quantity_grams}g
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-medium">
                        {remainingTrays} trays
                      </td>
                      <td className="p-4 text-center text-gray-500 font-semibold">
                        {s.reorder_threshold_trays} trays
                      </td>
                      <td className="p-4 text-right">
                        {editId === s.id ? (
                          <div className="space-x-2">
                            <button
                              onClick={() => handleSaveQty('seeds', s.id)}
                              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-2.5 py-1 rounded text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2.5 py-1 rounded text-xs border border-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditId(s.id); setEditQty(s.quantity_grams.toString()); }}
                            className="bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                          >
                            Adjust Stock
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* PACKAGES TABLE */}
          {activeTab === 'packages' && (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold">
                  <th className="p-4">Packaging Type / Size</th>
                  <th className="p-4 text-center">Available Stock (Units)</th>
                  <th className="p-4 text-center">Reorder Threshold</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packages.map(p => {
                  const isLow = p.quantity_available < p.reorder_threshold;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-4 font-semibold text-gray-900">
                        {p.variant?.crop?.name_en || 'Container'} — {p.variant?.size_name || 'Container 30g'}
                      </td>
                      <td className="p-4 text-center">
                        {editId === p.id ? (
                          <input
                            type="number"
                            value={editQty}
                            onChange={e => setEditQty(e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-center outline-none focus:ring-2 focus:ring-green-500"
                          />
                        ) : (
                          <span className={`font-bold ${isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                            {p.quantity_available} units
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center text-gray-500 font-semibold">
                        {p.reorder_threshold} units
                      </td>
                      <td className="p-4 text-right">
                        {editId === p.id ? (
                          <div className="space-x-2">
                            <button
                              onClick={() => handleSaveQty('packages', p.id)}
                              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-2.5 py-1 rounded text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2.5 py-1 rounded text-xs border border-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditId(p.id); setEditQty(p.quantity_available.toString()); }}
                            className="bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                          >
                            Adjust Stock
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* SAMPLES TABLE */}
          {activeTab === 'samples' && (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold">
                  <th className="p-4">Crop Variety</th>
                  <th className="p-4 text-center">Available Sample Weight (Grams)</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {samples.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{s.crop.name_en}</td>
                    <td className="p-4 text-center">
                      {editId === s.id ? (
                        <input
                          type="number"
                          value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-center outline-none focus:ring-2 focus:ring-green-500"
                        />
                      ) : (
                        <span className="font-bold text-gray-900">{s.available_grams}g</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {editId === s.id ? (
                        <div className="space-x-2">
                          <button
                            onClick={() => handleSaveQty('samples', s.id)}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-2.5 py-1 rounded text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2.5 py-1 rounded text-xs border border-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(s.id); setEditQty(s.available_grams.toString()); }}
                          className="bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                        >
                          Adjust Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      )}
    </div>
  );
}
