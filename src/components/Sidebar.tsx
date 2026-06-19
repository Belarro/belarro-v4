'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  {
    title: null,
    items: [{ label: 'Dashboard', href: '/admin', icon: '📊' }],
  },
  {
    title: 'PRODUCTION',
    items: [
      { label: 'Crop Configuration', href: '/admin/crops', icon: '🌱' },
      { label: 'Overview', href: '/admin/crops-overview', icon: '📋' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="p-6 border-b border-gray-200 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-green-600 flex items-center justify-center text-white font-bold text-lg">
          B
        </div>
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Belarro</h1>
          <p className="text-xs text-gray-500 font-medium">Farm Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && (
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                {section.title}
              </h3>
            )}
            {section.items.map((item) => {
              const isActive = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                    isActive
                      ? 'bg-green-50 text-green-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
        <p className="text-[11px] text-gray-400 font-medium">Belarro V4 Admin</p>
      </div>
    </aside>
  );
}
