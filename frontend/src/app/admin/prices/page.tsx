'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface Variant {
  id?: string;
  crop_id?: string;
  size_name: string;
  size_grams: number;
  price_eur?: number | null;
  is_internal: boolean;
  container_size?: string | null;
  container_qty?: number;
}

interface Crop {
  id: string;
  name_en: string;
  name_de: string;
  status: string;
  deleted_at?: string | null;
  variants: Variant[];
}

interface EditedCrop extends Crop {
  // map of size_name -> edited price string
  editedPrices: Record<string, string>;
  dirty: boolean;
}

export default function PricesPage() {
  const [crops, setCrops] = useState<EditedCrop[]>([]);
  const [allSizes, setAllSizes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [showAddSize, setShowAddSize] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeGrams, setNewSizeGrams] = useState('');

  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crops');
      const json = await res.json();
      if (!json.success) return;

      const rawCrops: Crop[] = (json.data || []).filter((c: Crop) => !c.deleted_at);

      // Collect all unique size names, sorted by grams
      const sizeMap = new Map<string, number>(); // size_name -> size_grams
      for (const crop of rawCrops) {
        for (const v of crop.variants || []) {
          if (!sizeMap.has(v.size_name)) sizeMap.set(v.size_name, v.size_grams);
        }
      }
      const sizes = Array.from(sizeMap.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([name]) => name);

      setAllSizes(sizes);
      setCrops(rawCrops.map(crop => {
        const editedPrices: Record<string, string> = {};
        for (const size of sizes) {
          const v = (crop.variants || []).find(x => x.size_name === size);
          editedPrices[size] = v?.price_eur != null ? String(v.price_eur) : '';
        }
        return { ...crop, editedPrices, dirty: false };
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  const handlePriceChange = (cropId: string, size: string, val: string) => {
    setCrops(prev => prev.map(c =>
      c.id === cropId ? { ...c, editedPrices: { ...c.editedPrices, [size]: val }, dirty: true } : c
    ));
  };

  const buildVariantsForCrop = (crop: EditedCrop, sizes: string[], sizeGrams: Map<string, number>): Variant[] => {
    const variantMap = new Map<string, Variant>();
    for (const v of crop.variants || []) {
      variantMap.set(v.size_name, { ...v });
    }
    for (const size of sizes) {
      const priceStr = crop.editedPrices[size];
      const price = priceStr !== '' ? parseFloat(priceStr) : null;
      if (variantMap.has(size)) {
        variantMap.get(size)!.price_eur = isNaN(price as number) ? null : price;
      } else if (price !== null && !isNaN(price as number)) {
        variantMap.set(size, {
          size_name: size,
          size_grams: sizeGrams.get(size) || 0,
          price_eur: price,
          is_internal: false,
        });
      }
    }
    return Array.from(variantMap.values()).filter(v => v.size_grams > 0);
  };

  const saveRow = async (cropId: string) => {
    const crop = crops.find(c => c.id === cropId);
    if (!crop) return;
    setSaving(cropId);

    const sizeGrams = new Map<string, number>();
    for (const c of crops) {
      for (const v of c.variants || []) {
        sizeGrams.set(v.size_name, v.size_grams);
      }
    }

    const variants = buildVariantsForCrop(crop, allSizes, sizeGrams);
    await fetch(`/api/crops/${cropId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cropId, variants }),
    });

    await fetch_();
    setSaving(null);
  };

  const saveAll = useCallback(async () => {
    const dirty = crops.filter(c => c.dirty);
    if (!dirty.length) return;
    setSavingAll(true);

    const sizeGrams = new Map<string, number>();
    for (const c of crops) {
      for (const v of c.variants || []) {
        sizeGrams.set(v.size_name, v.size_grams);
      }
    }

    await Promise.all(dirty.map(crop => {
      const variants = buildVariantsForCrop(crop, allSizes, sizeGrams);
      return fetch(`/api/crops/${crop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: crop.id, variants }),
      });
    }));

    await fetch_();
    setSavingAll(false);
  }, [crops, allSizes]);

  const handleAddSize = async () => {
    const name = newSizeName.trim();
    const grams = parseFloat(newSizeGrams);
    if (!name || isNaN(grams) || grams <= 0) return;

    // Add to allSizes, add empty price entry to all crops
    const newSizes = [...allSizes, name].sort((a, b) => {
      const ga = crops.flatMap(c => c.variants).find(v => v.size_name === a)?.size_grams ?? grams;
      const gb = crops.flatMap(c => c.variants).find(v => v.size_name === b)?.size_grams ?? grams;
      return ga - gb;
    });

    setAllSizes(newSizes);
    setCrops(prev => prev.map(c => ({
      ...c,
      editedPrices: { ...c.editedPrices, [name]: '' },
    })));
    setNewSizeName('');
    setNewSizeGrams('');
    setShowAddSize(false);
  };

  const hasDirty = crops.some(c => c.dirty);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Crop Summary</h1>
          <p className="text-sm text-gray-500 mt-1">
            Prices per crop and size. Changes here sync to the crop's Sizes & Prices tab.
          </p>
        </div>
        <button onClick={() => setShowAddSize(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition">
          + Add Size
        </button>
      </div>

      {/* Add size modal */}
      {showAddSize && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Size</h2>
            <p className="text-sm text-gray-500 mb-4">This adds a new column for all crops. You can then set prices per crop.</p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Size Name</label>
                <input value={newSizeName} onChange={e => setNewSizeName(e.target.value)}
                  placeholder="e.g., 50g box"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Weight (grams)</label>
                <input type="number" value={newSizeGrams} onChange={e => setNewSizeGrams(e.target.value)}
                  placeholder="e.g., 50"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowAddSize(false); setNewSizeName(''); setNewSizeGrams(''); }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleAddSize} disabled={!newSizeName.trim() || !newSizeGrams}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {crops.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
          No crops found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 sticky left-0 bg-gray-50 z-10 min-w-[180px]">
                  Crop
                </th>
                {allSizes.map(size => (
                  <th key={size} className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 min-w-[100px]">
                    {size}
                  </th>
                ))}
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {crops.map((crop, i) => (
                <tr key={crop.id}
                  className={`border-b transition ${crop.dirty ? 'bg-yellow-50 border-yellow-200' : 'border-gray-100 hover:bg-gray-50'} ${i === crops.length - 1 ? 'border-0' : ''}`}>
                  <td className={`px-5 py-3 sticky left-0 z-10 ${crop.dirty ? 'bg-yellow-50' : 'bg-white'}`}>
                    <div className="font-semibold text-gray-900 text-sm">{crop.name_en}</div>
                    <div className="text-xs text-gray-400">{crop.name_de}</div>
                    {crop.dirty && <span className="text-[10px] text-yellow-600 font-semibold">unsaved</span>}
                  </td>
                  {allSizes.map(size => {
                    const existing = (crop.variants || []).find(v => v.size_name === size);
                    const val = crop.editedPrices[size] ?? '';
                    return (
                      <td key={size} className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="text-gray-400 text-xs">€</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={val}
                            onChange={e => handlePriceChange(crop.id, size, e.target.value)}
                            placeholder={existing ? '—' : ''}
                            className="w-16 text-center text-sm border border-gray-200 bg-transparent rounded-lg px-2 py-1 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-200"
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <button onClick={() => saveRow(crop.id)}
                      disabled={!crop.dirty || saving === crop.id}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg transition
                        bg-green-600 hover:bg-green-700 text-white
                        disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed whitespace-nowrap">
                      {saving === crop.id ? '...' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky Save All bar */}
      {hasDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg z-40">
          <span className="text-sm text-gray-600">
            {crops.filter(c => c.dirty).length} crop{crops.filter(c => c.dirty).length > 1 ? 's' : ''} with unsaved changes
          </span>
          <button onClick={saveAll} disabled={savingAll}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition">
            {savingAll ? 'Saving...' : 'Save All'}
          </button>
        </div>
      )}
    </div>
  );
}
