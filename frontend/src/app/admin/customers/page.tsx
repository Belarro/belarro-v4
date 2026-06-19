'use client';

import React, { useEffect, useState } from 'react';

interface Customer {
  id: string;
  name: string;
  restaurant_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  status: 'prospect' | 'active' | 'paused' | 'inactive';
  net_days: number;
  first_contact_date: string;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'prospect' | 'active' | 'paused' | 'inactive'>('prospect');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    restaurant_name: '',
    contact_person: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    net_days: '30',
    status: 'prospect' as 'prospect' | 'active' | 'paused' | 'inactive'
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers');
      const json = await res.json();
      if (json.success) {
        setCustomers(json.data || []);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        net_days: parseInt(formData.net_days) || 30
      };

      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        setShowModal(false);
        resetForm();
        fetchCustomers();
      }
    } catch (error) {
      console.error('Failed to save customer:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      restaurant_name: '',
      contact_person: '',
      email: '',
      phone: '',
      whatsapp: '',
      address: '',
      city: '',
      net_days: '30',
      status: 'prospect'
    });
    setEditingCustomer(null);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      restaurant_name: c.restaurant_name || '',
      contact_person: c.contact_person || '',
      email: c.email || '',
      phone: c.phone || '',
      whatsapp: c.whatsapp || '',
      address: c.address || '',
      city: c.city || '',
      net_days: c.net_days.toString(),
      status: c.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer? This will delete all their orders and follow-ups.')) {
      try {
        const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          fetchCustomers();
        }
      } catch (error) {
        console.error('Failed to delete customer:', error);
      }
    }
  };

  const handleStatusToggle = async (c: Customer) => {
    const nextStatus = c.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/customers/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (json.success) {
        fetchCustomers();
      }
    } catch (error) {
      console.error('Failed to toggle customer status:', error);
    }
  };

  const filteredCustomers = customers.filter(c => c.status === activeTab);
  const statusCounts = {
    prospect: customers.filter(c => c.status === 'prospect').length,
    active: customers.filter(c => c.status === 'active').length,
    paused: customers.filter(c => c.status === 'paused').length,
    inactive: customers.filter(c => c.status === 'inactive').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Customer Relationship Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage leads, chefs, and restaurant accounts</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-lg shadow transition"
        >
          + New Customer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['prospect', 'active', 'paused', 'inactive'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 capitalize transition ${
              activeTab === tab 
                ? 'border-green-600 text-green-700 font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab}s ({statusCounts[tab]})
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No {activeTab} customers found. Click "+ New Customer" to add one!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{c.name}</h3>
                {c.restaurant_name && (
                  <p className="text-xs text-gray-500 font-medium">{c.restaurant_name}</p>
                )}
                {c.contact_person && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-600">
                    <span>👤</span>
                    <span>Chef: {c.contact_person}</span>
                  </div>
                )}
                
                {/* Contact List */}
                <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
                  {c.email && <div className="truncate">📧 {c.email}</div>}
                  {c.phone && <div>📞 {c.phone}</div>}
                  {c.whatsapp && <div>💬 WhatsApp: {c.whatsapp}</div>}
                  {c.city && <div>📍 {c.address}, {c.city}</div>}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Terms: <strong>{c.net_days} Net Days</strong></span>
                <span className="text-[10px] text-gray-400">Created: {new Date(c.created_at).toLocaleDateString()}</span>
              </div>

              {/* Action buttons */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  onClick={() => openEditModal(c)}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-700 py-1.5 rounded-lg border border-gray-200 font-semibold text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleStatusToggle(c)}
                  className={`py-1.5 rounded-lg border font-semibold text-xs ${
                    c.status === 'active' 
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' 
                      : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                  }`}
                >
                  {c.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-700 py-1.5 rounded-lg border border-red-200 font-semibold text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCustomer ? 'Edit Customer Account' : 'Register New Customer'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Company/Client Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="e.g., Altes Zollhaus"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Restaurant Name</label>
                  <input
                    type="text"
                    value={formData.restaurant_name}
                    onChange={e => setFormData({ ...formData, restaurant_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="e.g., Zollhaus Bistro"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Person (Chef/Manager)</label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g., Chef Pierre Granger"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="e.g., chef@zollhaus.de"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="e.g., +49 1520 ..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp (For followups)</label>
                  <input
                    type="text"
                    value={formData.whatsapp}
                    onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="e.g., 491520123456"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Payment terms (Net Days)</label>
                  <input
                    type="number"
                    value={formData.net_days}
                    onChange={e => setFormData({ ...formData, net_days: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Initial Funnel Stage</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="prospect">Prospect (Logged Lead)</option>
                  <option value="active">Active (Standard Customer)</option>
                  <option value="paused">Paused (Temporarily Suspended)</option>
                  <option value="inactive">Inactive (Terminated/Lost)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow"
                >
                  {editingCustomer ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
