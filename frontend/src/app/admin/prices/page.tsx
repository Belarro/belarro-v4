'use client';

import React, { useEffect, useState, useCallback } from 'react';

const ALL_SIZES = ['container', '100g', '225g', '450g'];

interface Product {
  id: string;
  name: string;
  sort_order: number;
  prices: Record<string, number | string>;
  available_sizes: string[];
}

interface DirtyProduct extends Product {
  dirty: boolean;
}

export default function PricesPage() {
  const [products, setProducts] = useState<DirtyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const json = await res.json();
      if (json.success) setProducts(json.data.map((p: Product) => ({ ...p, dirty: false })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  const setPrice = (productId: string, size: string, value: string) => {
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, dirty: true, prices: { ...p.prices, [size]: value } } : p
    ));
  };

  const addSize = (productId: string, size: string) => {
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, dirty: true, available_sizes: [...p.available_sizes, size], prices: { ...p.prices, [size]: '' } } : p
    ));
  };

  const removeSize = (productId: string, size: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const newPrices = { ...p.prices };
      delete newPrices[size];
      return { ...p, dirty: true, available_sizes: p.available_sizes.filter(s => s !== size), prices: newPrices };
    }));
  };

  const saveProduct = async (p: DirtyProduct) => {
    setSaving(p.id);
    const cleanPrices: Record<string, number> = {};
    for (const [size, val] of Object.entries(p.prices)) {
      const n = parseFloat(String(val));
      if (!isNaN(n)) cleanPrices[size] = n;
    }
    await fetch(`/api/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prices: cleanPrices, available_sizes: p.available_sizes }),
    });
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, prices: cleanPrices, dirty: false } : x));
    setSaving(null);
  };

  const saveAll = useCallback(async () => {
    setSavingAll(true);
    const dirty = products.filter(p => p.dirty);
    await Promise.all(dirty.map(p => saveProduct(p)));
    setSavingAll(false);
  }, [products]);

  const hasDirty = products.some(p => p.dirty);

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Crop Summary</h1>
          <p className="text-sm text-gray-500 mt-1">Prices per crop and packaging size. Edit inline and save.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
          No products found.
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => {
            const unusedSizes = ALL_SIZES.filter(s => !p.available_sizes.includes(s));
            return (
              <div key={p.id} className={`bg-white rounded-xl border transition ${p.dirty ? 'border-yellow-300 shadow-sm shadow-yellow-100' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    {p.dirty && <span className="text-xs text-yellow-600 font-medium bg-yellow-50 px-2 py-0.5 rounded-full">Unsaved</span>}
                  </div>
                  <button
                    onClick={() => saveProduct(p)}
                    disabled={!p.dirty || saving === p.id}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-40
                      bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-200 disabled:text-gray-400">
                    {saving === p.id ? 'Saving...' : 'Save'}
                  </button>
                </div>

                <div className="p-5">
                  {p.available_sizes.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No sizes added yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {p.available_sizes.map(size => (
                        <div key={size} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">{size}</span>
                          <span className="text-gray-400 text-sm">€</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={p.prices[size] ?? ''}
                            onChange={e => setPrice(p.id, size, e.target.value)}
                            className="w-16 bg-transparent text-sm text-gray-900 font-medium outline-none border-b border-gray-200 focus:border-green-500 pb-0.5"
                            placeholder="0.00"
                          />
                          <button
                            onClick={() => removeSize(p.id, size)}
                            className="ml-1 text-gray-300 hover:text-red-500 text-sm font-bold leading-none transition"
                            title="Remove size">
                            ×
                          </button>
                        </div>
                      ))}

                      {unusedSizes.map(size => (
                        <button
                          key={size}
                          onClick={() => addSize(p.id, size)}
                          className="flex items-center gap-1 px-3 py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-green-400 hover:text-green-600 transition">
                          <span className="text-base leading-none">+</span>
                          <span>{size}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {p.available_sizes.length > 0 && unusedSizes.length === 0 && (
                    <p className="text-xs text-gray-400 mt-3">All sizes added.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Save All bar */}
      {hasDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg z-40">
          <span className="text-sm text-gray-600">
            {products.filter(p => p.dirty).length} crop{products.filter(p => p.dirty).length > 1 ? 's' : ''} with unsaved changes
          </span>
          <button
            onClick={saveAll}
            disabled={savingAll}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition">
            {savingAll ? 'Saving...' : 'Save All'}
          </button>
        </div>
      )}
    </div>
  );
}
