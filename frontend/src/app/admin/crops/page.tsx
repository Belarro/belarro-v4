'use client';

import { useEffect, useState } from 'react';

interface GrowthProcedure {
  id?: string;
  crop_id?: string;
  soak_enabled: boolean;
  soak_hours?: number;
  cover_soil_enabled: boolean;
  stack_enabled: boolean;
  stack_days?: number;
  growth_env_type: 'light' | 'blackout' | 'humidity_dome';
  growth_env_days: number;
  humidity_dome_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ProductVariant {
  id?: string;
  crop_id?: string;
  size_name: string;
  size_grams: number;
  price_eur?: number;
  is_internal: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Crop {
  id: string;
  name_en: string;
  name_de: string;
  flavor_en?: string;
  flavor_de?: string;
  status: 'active' | 'paused';
  procedure?: GrowthProcedure;
  variants?: ProductVariant[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

type Tab = 'basics' | 'procedure' | 'sizes';

const GROWTH_ENV_OPTIONS = ['light', 'blackout', 'humidity_dome'] as const;

export default function AdminCropsPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('basics');
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewCrop, setIsNewCrop] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name_en: '',
    name_de: '',
    flavor_en: '',
    flavor_de: '',
    status: 'active' as 'active' | 'paused',
  });

  const [procedure, setProcedure] = useState<GrowthProcedure>({
    soak_enabled: false,
    soak_hours: undefined,
    cover_soil_enabled: false,
    stack_enabled: false,
    stack_days: undefined,
    growth_env_type: 'light',
    growth_env_days: 0,
    humidity_dome_enabled: false,
  });

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [newVariant, setNewVariant] = useState({ size_name: '', size_grams: '', price_eur: '' });

  // Fetch crops
  const fetchCrops = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/crops');
      const json = await res.json();
      if (json.success) {
        setCrops(json.data || []);
      } else {
        showToast('Failed to load crops', 'error');
      }
    } catch (error) {
      console.error('Failed to load crops:', error);
      showToast('Error loading crops', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);

  // Load selected crop
  useEffect(() => {
    if (selectedCropId && !isNewCrop) {
      loadCropData(selectedCropId);
    }
  }, [selectedCropId]);

  const loadCropData = async (cropId: string) => {
    try {
      const res = await fetch(`/api/crops?id=${cropId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const crop = json.data;
        setFormData({
          name_en: crop.name_en || '',
          name_de: crop.name_de || '',
          flavor_en: crop.flavor_en || '',
          flavor_de: crop.flavor_de || '',
          status: crop.status || 'active',
        });
        setProcedure(crop.procedure || {
          soak_enabled: false,
          soak_hours: undefined,
          cover_soil_enabled: false,
          stack_enabled: false,
          stack_days: undefined,
          growth_env_type: 'light',
          growth_env_days: 0,
          humidity_dome_enabled: false,
        });
        setVariants(crop.variants || []);
      }
    } catch (error) {
      console.error('Failed to load crop:', error);
      showToast('Failed to load crop data', 'error');
    }
  };

  const selectedCrop = crops.find(c => c.id === selectedCropId);
  const filteredCrops = crops.filter(c =>
    (c.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name_de.toLowerCase().includes(searchQuery.toLowerCase())) &&
    !c.deleted_at
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!formData.name_en || !formData.name_de) {
      showToast('Name (EN) and Name (DE) are required', 'error');
      return;
    }

    if (procedure.growth_env_days <= 0) {
      showToast('Growth environment days must be greater than 0', 'error');
      return;
    }

    if (procedure.soak_enabled && !procedure.soak_hours) {
      showToast('Soak hours required if soak is enabled', 'error');
      return;
    }

    if (procedure.stack_enabled && !procedure.stack_days) {
      showToast('Stack days required if stack is enabled', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        id: isNewCrop ? undefined : selectedCropId,
        name_en: formData.name_en,
        name_de: formData.name_de,
        flavor_en: formData.flavor_en || null,
        flavor_de: formData.flavor_de || null,
        status: formData.status,
        procedure,
        variants: variants.filter(v => v.size_name && v.size_grams),
      };

      const method = isNewCrop ? 'POST' : 'PUT';
      const url = isNewCrop ? '/api/crops' : `/api/crops/${selectedCropId}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showToast(isNewCrop ? 'Crop created' : 'Crop updated', 'success');
        setIsNewCrop(false);
        setIsEditing(false);
        if (isNewCrop) {
          setSelectedCropId(json.data.id);
        }
        await fetchCrops();
      } else {
        showToast(json.error || 'Failed to save', 'error');
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast('Error saving crop', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCropId) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/crops/${selectedCropId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedCropId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Crop deleted', 'success');
        setShowDeleteConfirm(false);
        setSelectedCropId(null);
        await fetchCrops();
      } else {
        showToast('Failed to delete', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Error deleting crop', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleNewCrop = () => {
    setIsNewCrop(true);
    setSelectedCropId(null);
    setIsEditing(true);
    setActiveTab('basics');
    setFormData({ name_en: '', name_de: '', flavor_en: '', flavor_de: '', status: 'active' });
    setProcedure({
      soak_enabled: false,
      soak_hours: undefined,
      cover_soil_enabled: false,
      stack_enabled: false,
      stack_days: undefined,
      growth_env_type: 'light',
      growth_env_days: 0,
      humidity_dome_enabled: false,
    });
    setVariants([]);
  };

  const handleAddVariant = () => {
    if (!newVariant.size_name || !newVariant.size_grams) {
      showToast('Size name and grams required', 'error');
      return;
    }
    setVariants([
      ...variants,
      {
        size_name: newVariant.size_name,
        size_grams: parseFloat(newVariant.size_grams),
        price_eur: newVariant.price_eur ? parseFloat(newVariant.price_eur) : undefined,
        is_internal: newVariant.size_name.toLowerCase() === 'container',
      },
    ]);
    setNewVariant({ size_name: '', size_grams: '', price_eur: '' });
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const calculateTotalDays = () => {
    let days = 0;
    if (procedure.stack_enabled && procedure.stack_days) {
      days += procedure.stack_days;
    }
    if (procedure.growth_env_days) {
      days += procedure.growth_env_days;
    }
    return days;
  };

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
      <div className="bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-3xl font-bold text-gray-900">Crops</h1>
        <button
          onClick={handleNewCrop}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition"
        >
          + New Crop
        </button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-[350px_1fr] gap-6 h-[calc(100vh-120px)] p-6">
        {/* LEFT: Crop list */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search crops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filteredCrops.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No crops found</div>
            ) : (
              filteredCrops.map((crop) => (
                <button
                  key={crop.id}
                  onClick={() => {
                    setSelectedCropId(crop.id);
                    setIsNewCrop(false);
                    setIsEditing(false);
                  }}
                  className={`w-full p-3 border-b border-gray-100 text-left transition focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    selectedCropId === crop.id
                      ? 'bg-blue-50 border-l-4 border-l-green-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{crop.name_en}</p>
                      <p className="text-xs text-gray-600">{crop.name_de}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                        crop.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {crop.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Detail panel */}
        {isNewCrop || selectedCrop ? (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {isNewCrop ? 'New Crop' : selectedCrop?.name_en}
              </h2>
              {!isNewCrop && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isEditing}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Delete
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {(['basics', 'procedure', 'sizes'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  disabled={isEditing && tab !== activeTab}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    activeTab === tab
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  } ${isEditing && tab !== activeTab ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {tab === 'basics' && 'Basics'}
                  {tab === 'procedure' && 'Growth Procedure'}
                  {tab === 'sizes' && 'Sizes & Prices'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* BASICS TAB */}
              {activeTab === 'basics' && (
                <div className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Name (English) *</label>
                    <input
                      type="text"
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Pea Shoots"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Name (German) *</label>
                    <input
                      type="text"
                      value={formData.name_de}
                      onChange={(e) => setFormData({ ...formData, name_de: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Erbsensprossen"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Flavor Profile (English)</label>
                    <input
                      type="text"
                      value={formData.flavor_en}
                      onChange={(e) => setFormData({ ...formData, flavor_en: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Sweet, crunchy"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Flavor Profile (German)</label>
                    <input
                      type="text"
                      value={formData.flavor_de}
                      onChange={(e) => setFormData({ ...formData, flavor_de: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="z.B. süß, knackig"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'paused' })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                </div>
              )}

              {/* PROCEDURE TAB */}
              {activeTab === 'procedure' && (
                <div className="space-y-6 max-w-2xl">
                  {/* Total growth days */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-900">
                      Total Growth Days: <span className="text-2xl font-bold text-green-600">{calculateTotalDays()}</span>
                    </p>
                  </div>

                  {/* Soak */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="flex items-center gap-3 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={procedure.soak_enabled}
                        onChange={(e) => setProcedure({ ...procedure, soak_enabled: e.target.checked })}
                        disabled={!isEditing}
                        className="w-4 h-4"
                      />
                      <span className="text-lg">💧</span>
                      <span className="font-semibold text-gray-900 flex-1">Soak</span>
                    </label>
                    {procedure.soak_enabled && isEditing && (
                      <div className="ml-7">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                        <input
                          type="number"
                          min="1"
                          value={procedure.soak_hours || ''}
                          onChange={(e) => setProcedure({ ...procedure, soak_hours: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    )}
                    {procedure.soak_enabled && !isEditing && (
                      <p className="ml-7 text-sm text-gray-700">{procedure.soak_hours} hours</p>
                    )}
                  </div>

                  {/* Seed */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🌱</span>
                      <span className="font-semibold text-gray-900">Seed</span>
                      <span className="text-xs text-gray-600">(Always required)</span>
                    </div>
                  </div>

                  {/* Cover Soil */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={procedure.cover_soil_enabled}
                        onChange={(e) => setProcedure({ ...procedure, cover_soil_enabled: e.target.checked })}
                        disabled={!isEditing}
                        className="w-4 h-4"
                      />
                      <span className="text-lg">🌍</span>
                      <span className="font-semibold text-gray-900">Cover Soil</span>
                    </label>
                  </div>

                  {/* Stack */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="flex items-center gap-3 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={procedure.stack_enabled}
                        onChange={(e) => setProcedure({ ...procedure, stack_enabled: e.target.checked })}
                        disabled={!isEditing}
                        className="w-4 h-4"
                      />
                      <span className="text-lg">📚</span>
                      <span className="font-semibold text-gray-900">Stack</span>
                    </label>
                    {procedure.stack_enabled && isEditing && (
                      <div className="ml-7">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Days</label>
                        <input
                          type="number"
                          min="1"
                          value={procedure.stack_days || ''}
                          onChange={(e) => setProcedure({ ...procedure, stack_days: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    )}
                    {procedure.stack_enabled && !isEditing && (
                      <p className="ml-7 text-sm text-gray-700">{procedure.stack_days} days</p>
                    )}
                  </div>

                  {/* Growth Environment */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-3">Growth Environment</label>
                    <div className="mb-3">
                      <select
                        value={procedure.growth_env_type}
                        onChange={(e) => setProcedure({ ...procedure, growth_env_type: e.target.value as 'light' | 'blackout' | 'humidity_dome' })}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="light">💡 Light</option>
                        <option value="blackout">🌑 Blackout</option>
                        <option value="humidity_dome">💨 Humidity Dome</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Duration (Days) *</label>
                      <input
                        type="number"
                        min="1"
                        value={procedure.growth_env_days || ''}
                        onChange={(e) => setProcedure({ ...procedure, growth_env_days: e.target.value ? parseInt(e.target.value) : 0 })}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {procedure.growth_env_type === 'light' && isEditing && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={procedure.humidity_dome_enabled}
                          onChange={(e) => setProcedure({ ...procedure, humidity_dome_enabled: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Also use humidity dome (concurrent, same duration)</span>
                      </label>
                    )}

                    {!isEditing && (
                      <div className="text-sm text-gray-700">
                        <p><strong>{procedure.growth_env_type}</strong> for {procedure.growth_env_days} days</p>
                        {procedure.growth_env_type === 'light' && procedure.humidity_dome_enabled && (
                          <p className="text-xs text-gray-600 mt-1">+ Humidity dome (concurrent)</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Harvest */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🌾</span>
                      <span className="font-semibold text-gray-900">Harvest</span>
                      <span className="text-xs text-gray-600">(End of cycle)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SIZES & PRICES TAB */}
              {activeTab === 'sizes' && (
                <div className="space-y-6 max-w-2xl">
                  {/* Current sizes table */}
                  {variants.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Sizes</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="p-2 text-left text-xs font-semibold text-gray-600">Size</th>
                              <th className="p-2 text-left text-xs font-semibold text-gray-600">Internal Grams</th>
                              <th className="p-2 text-left text-xs font-semibold text-gray-600">Price (€)</th>
                              {isEditing && <th className="p-2 text-center text-xs font-semibold text-gray-600">Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((variant, idx) => (
                              <tr key={idx} className="border-b border-gray-100">
                                <td className="p-2">{variant.size_name}</td>
                                <td className="p-2 text-gray-600">{variant.size_grams}g</td>
                                <td className="p-2">{variant.price_eur ? '€' + variant.price_eur.toFixed(2) : '—'}</td>
                                {isEditing && (
                                  <td className="p-2 text-center">
                                    <button
                                      onClick={() => handleRemoveVariant(idx)}
                                      className="text-red-600 hover:text-red-700 text-xs font-medium"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Add new size form */}
                  {isEditing && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Size</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Size Name</label>
                          <input
                            type="text"
                            placeholder="e.g., 600g"
                            value={newVariant.size_name}
                            onChange={(e) => setNewVariant({ ...newVariant, size_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Grams (Internal)</label>
                          <input
                            type="number"
                            placeholder="e.g., 600"
                            value={newVariant.size_grams}
                            onChange={(e) => setNewVariant({ ...newVariant, size_grams: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Price (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="e.g., 18.50"
                            value={newVariant.price_eur}
                            onChange={(e) => setNewVariant({ ...newVariant, price_eur: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <button
                          onClick={handleAddVariant}
                          className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
                        >
                          Add Size
                        </button>
                      </div>
                    </div>
                  )}

                  {variants.length === 0 && !isEditing && (
                    <p className="text-sm text-gray-600">No sizes defined yet</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              {isEditing || isNewCrop ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      if (isNewCrop) {
                        setIsNewCrop(false);
                        setSelectedCropId(null);
                      } else {
                        loadCropData(selectedCropId!);
                      }
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-6 py-2 rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center text-gray-500">
            Select a crop to view details
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Crop</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete <strong>{selectedCrop?.name_en}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg text-white font-medium ${
          toastMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastMessage.text}
        </div>
      )}
    </div>
  );
}
