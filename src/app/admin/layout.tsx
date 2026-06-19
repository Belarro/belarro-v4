import Sidebar from '@/components/Sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
