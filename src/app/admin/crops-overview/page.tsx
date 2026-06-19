'use client';

import { useEffect, useState } from 'react';

interface GrowthProcedure {
  soak_enabled: boolean;
  cover_soil_enabled: boolean;
  stack_enabled: boolean;
  light_enabled: boolean;
  blackout_enabled: boolean;
  humidity_dome_enabled: boolean;
  stack_days?: number;
  light_days?: number;
  blackout_days?: number;
}

interface ProductVariant {
  size_name: string;
  size_grams: number;
  price_eur?: number;
}

interface Crop {
  id: string;
  name_en: string;
  name_de: string;
  status: 'active' | 'paused';
  photo_url?: string;
  procedure?: GrowthProcedure;
  variants?: ProductVariant[];
  deleted_at?: string | null;
}

export default function CropsOverviewPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCrops = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/crops');
      const json = await res.json();
      if (json.success) {
        setCrops(json.data || []);
      }
    } catch (error) {
      console.error('Failed to load crops:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);

  const filteredCrops = crops.filter(c =>
    (c.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name_de.toLowerCase().includes(searchQuery.toLowerCase())) &&
    !c.deleted_at
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading crops...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10">
        <h1 className="text-3xl font-bold text-gray-900">Crops Overview</h1>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search crops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 text-center font-semibold text-gray-700">Photo</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Crop Name</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Status</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Growth Procedure</th>
                  <th className="p-4 text-center font-semibold text-gray-700">Total Days</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Sizes & Prices</th>
                </tr>
              </thead>
              <tbody>
                {filteredCrops.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No crops found
                    </td>
                  </tr>
                ) : (
                  filteredCrops.map((crop) => {
                    const procSteps = [];
                    if (crop.procedure?.soak_enabled) procSteps.push('✓ Soak');
                    if (crop.procedure?.cover_soil_enabled) procSteps.push('✓ Cover Soil');
                    if (crop.procedure?.stack_enabled) procSteps.push('✓ Stack');
                    if (crop.procedure?.light_enabled) procSteps.push('✓ Light');
                    if (crop.procedure?.blackout_enabled) procSteps.push('✓ Blackout');
                    if (crop.procedure?.humidity_dome_enabled) procSteps.push('✓ Humidity Dome');

                    const totalDays = (crop.procedure?.stack_days || 0) +
                      (crop.procedure?.light_days || 0) +
                      (crop.procedure?.blackout_days || 0);

                    const variantsList = Array.isArray(crop.variants) ? crop.variants : [];
                    const prices = variantsList
                      .filter(v => v.price_eur)
                      .map(v => v.price_eur)
                      .sort((a, b) => a! - b!);
                    const priceRange = prices.length > 0
                      ? prices.length === 1
                        ? `€${prices[0]?.toFixed(2)}`
                        : `€${prices[0]?.toFixed(2)} – €${prices[prices.length - 1]?.toFixed(2)}`
                      : '—';

                    const sizesStr = variantsList
                      .map(v => `${v.size_name} (${v.size_grams}g)`)
                      .join(', ') || '—';

                    return (
                      <tr key={crop.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="p-4 text-center">
                          {crop.photo_url ? (
                            <img
                              src={crop.photo_url}
                              alt={crop.name_en}
                              className="w-12 h-12 object-cover rounded mx-auto"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded mx-auto flex items-center justify-center text-xs text-gray-400">
                              —
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-semibold text-gray-900">{crop.name_en}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            crop.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {crop.status}
                          </span>
                        </td>
                        <td className="p-4 text-gray-700 text-xs">
                          {procSteps.length > 0 ? procSteps.join(' • ') : '—'}
                        </td>
                        <td className="p-4 text-center font-semibold text-gray-900">{totalDays}</td>
                        <td className="p-4 text-gray-700 text-xs">
                          <div className="space-y-1">
                            <div><span className="font-medium">Sizes:</span> {sizesStr}</div>
                            <div><span className="font-medium">Price:</span> {priceRange}</div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total Crops</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{filteredCrops.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {filteredCrops.filter(c => c.status === 'active').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Paused</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {filteredCrops.filter(c => c.status === 'paused').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total Variants</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {filteredCrops.reduce((sum, c) => sum + (Array.isArray(c.variants) ? c.variants.length : 0), 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
