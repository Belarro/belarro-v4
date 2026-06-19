'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface ErrorEntry {
  id: string
  timestamp: string
  endpoint: string
  status: number | null
  message: string
  user_id: string | null
  stack: string | null
}

export default function ErrorLogPage() {
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchErrors = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data } = await supabase
        .from('belarro_v4_error_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      setErrors(data || [])
      setLoading(false)
    }

    fetchErrors()
  }, [])

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Error Log</h1>
      {errors.length === 0 ? (
        <div className="text-gray-500">No errors recorded.</div>
      ) : (
        <div className="overflow-x-auto border border-gray-300 rounded">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-3 text-left text-sm font-semibold">Timestamp</th>
                <th className="p-3 text-left text-sm font-semibold">Endpoint</th>
                <th className="p-3 text-left text-sm font-semibold">Status</th>
                <th className="p-3 text-left text-sm font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err) => (
                <tr key={err.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-3 text-sm text-gray-700">
                    {new Date(err.timestamp || err.id).toLocaleString()}
                  </td>
                  <td className="p-3 text-sm font-mono text-gray-700">{err.endpoint}</td>
                  <td className="p-3 text-sm text-gray-700">{err.status || '—'}</td>
                  <td className="p-3 text-sm text-gray-700 max-w-md truncate">{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
