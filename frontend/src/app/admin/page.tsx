'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import FollowUpWidget from '@/components/FollowUpWidget';

interface DashboardData {
  overview: {
    total_crops: number;
    active_crops: number;
    total_customers: number;
    active_customers: number;
    prospect_customers: number;
    total_orders: number;
    pending_orders: number;
  };
  revenue: {
    total_order_value_eur: number;
    average_order_value_eur: number;
    orders_counted: number;
  };
  operations: {
    active_seeding_batches: number;
    pending_follow_ups: number;
    follow_up_conversion_rate_percent?: number;
  };
  lead_sources?: {
    website: number;
    saletracker: number;
    total: number;
  };
  alerts: {
    seed_reorder_alerts: number;
    package_reorder_alerts: number;
  };
  customer_funnel: {
    prospects: number;
    active: number;
    paused: number;
    inactive: number;
    conversion_rate_percent: number;
  };
  recent_activity: {
    recent_orders: Array<{
      id: string;
      customer: string;
      product: string;
      quantity: number;
      date: string;
      status: string;
    }>;
    recent_customers: Array<{
      id: string;
      name: string;
      status: string;
      created_at: string;
    }>;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(resJson => {
        if (resJson.success) {
          setData(resJson.data);
        }
      })
      .catch(err => console.error('Dashboard load failed:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Today's follow-ups — first thing Ron sees */}
      <FollowUpWidget />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Farm Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time KPIs and operational metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Crops Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition duration-200">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Crops</span>
            <div className="text-4xl font-extrabold text-green-600 mt-2">{data.overview.total_crops}</div>
          </div>
          <div className="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
            {data.overview.active_crops} active varieties
          </div>
        </div>

        {/* Customers Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition duration-200">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customers</span>
            <div className="text-4xl font-extrabold text-blue-600 mt-2">{data.overview.total_customers}</div>
          </div>
          <div className="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
            {data.overview.active_customers} active buyers
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition duration-200">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Orders</span>
            <div className="text-4xl font-extrabold text-purple-600 mt-2">{data.overview.total_orders}</div>
          </div>
          <div className="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
            {data.overview.pending_orders} pending fulfillment
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition duration-200">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenue</span>
            <div className="text-3xl font-extrabold text-amber-600 mt-2">€{data.revenue.total_order_value_eur.toFixed(2)}</div>
          </div>
          <div className="text-xs text-gray-500 mt-4">
            Average Order: €{data.revenue.average_order_value_eur.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Grid for details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Operations */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">Active Operations</h2>
          <div className="divide-y divide-gray-100">
            <div className="py-3 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Seeding Batches</span>
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-50 text-green-700">
                {data.operations.active_seeding_batches} active
              </span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Pending Follow-ups</span>
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700">
                {data.operations.pending_follow_ups} remaining
              </span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Follow-up Conversion</span>
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-50 text-green-700">
                {data.operations.follow_up_conversion_rate_percent ?? 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Reorder Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">Reorder Alerts</h2>
          <div className="divide-y divide-gray-100">
            <div className="py-3 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Seed Inventory</span>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                data.alerts.seed_reorder_alerts > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
              }`}>
                {data.alerts.seed_reorder_alerts} alerts
              </span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Package Inventory</span>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                data.alerts.package_reorder_alerts > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'
              }`}>
                {data.alerts.package_reorder_alerts} alerts
              </span>
            </div>
          </div>
        </div>

        {/* Customer Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">Customer Funnel</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Prospects</span>
              <div className="text-lg font-bold text-gray-800 mt-1">{data.customer_funnel.prospects}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Active</span>
              <div className="text-lg font-bold text-green-600 mt-1">{data.customer_funnel.active}</div>
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Conversion Rate</span>
            <span className="font-bold text-gray-800">{data.customer_funnel.conversion_rate_percent}%</span>
          </div>
          {data.lead_sources && (
            <div className="pt-2 border-t border-gray-100 space-y-1.5">
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Lead Sources</span>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Website</span>
                <span className="font-bold text-blue-600">{data.lead_sources.website}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>SaleTracker / Manual</span>
                <span className="font-bold text-gray-800">{data.lead_sources.saletracker}</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Recent Activity lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs font-semibold text-green-600 hover:text-green-700">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 font-medium text-xs border-b border-gray-100">
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recent_activity.recent_orders.map((o) => (
                  <tr key={o.id} className="text-gray-700">
                    <td className="py-2.5 font-medium">{o.customer}</td>
                    <td className="py-2.5 text-gray-500">{o.product}</td>
                    <td className="py-2.5 text-right font-semibold">{o.quantity}</td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        o.status === 'delivered' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.recent_activity.recent_orders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-gray-400">No recent orders logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Prospects */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900">New Prospects</h2>
            <Link href="/admin/customers" className="text-xs font-semibold text-green-600 hover:text-green-700">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 font-medium text-xs border-b border-gray-100">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recent_activity.recent_customers.map((c) => (
                  <tr key={c.id} className="text-gray-700">
                    <td className="py-2.5 font-medium">{c.name}</td>
                    <td className="py-2.5">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        c.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-gray-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {data.recent_activity.recent_customers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-gray-400">No new prospects registered.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
