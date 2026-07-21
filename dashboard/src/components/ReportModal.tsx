'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, FileText, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export default function ReportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'csv' | 'pdf'>('csv');
  const [loading, setLoading] = useState(false);
  const [csvStart, setCsvStart] = useState('');
  const [csvEnd, setCsvEnd] = useState('');
  const [pdfDate, setPdfDate] = useState('');

  if (!isOpen) return null;

  const downloadCSV = async () => {
    if (!csvStart || !csvEnd) return alert("Pilih rentang tanggal!");
    setLoading(true);
    
    // Ensure end date includes the whole day
    const endDate = new Date(csvEnd);
    endDate.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('sensor_logs')
      .select('*')
      .gte('created_at', new Date(csvStart).toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      alert("Gagal mengambil data atau data kosong.");
      setLoading(false);
      return;
    }

    // Convert JSON to CSV
    const headers = ['waktu', 'air_temp', 'air_hum', 'leaf_temp', 'vpd', 'soil_cb', 'light_lux', 'risk_level', 'fan_on', 'vent_angle'];
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = [
        new Date(row.created_at).toLocaleString(),
        row.air_temp, row.air_hum, row.leaf_temp, row.vpd,
        row.soil, row.light, row.risk_level, row.fan, row.vent
      ];
      csvRows.push(values.map(v => `"${v}"`).join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VaniGrow_Data_${csvStart}_to_${csvEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  };

  const downloadPDF = async () => {
    if (!pdfDate) return alert("Pilih tanggal!");
    setLoading(true);

    const start = new Date(pdfDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(pdfDate);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('sensor_logs')
      .select('created_at, risk_level, vpd')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      alert("Data tidak ditemukan pada tanggal tersebut.");
      setLoading(false);
      return;
    }

    // Analyze data: group by hour
    const hourlyStats: Record<string, { total: number; critical: number; minVpd: number }> = {};
    
    for (let i = 0; i < 24; i++) {
      const hourKey = i.toString().padStart(2, '0') + ':00';
      hourlyStats[hourKey] = { total: 0, critical: 0, minVpd: 99 };
    }

    let totalCritical = 0;

    data.forEach(log => {
      const dateObj = new Date(log.created_at);
      const hourKey = dateObj.getHours().toString().padStart(2, '0') + ':00';
      
      hourlyStats[hourKey].total += 1;
      if (log.vpd < hourlyStats[hourKey].minVpd) {
        hourlyStats[hourKey].minVpd = log.vpd;
      }

      if (log.risk_level === 'HIGH') {
        hourlyStats[hourKey].critical += 1;
        totalCritical += 1;
      }
    });

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("Laporan Harian Fungal Risk - VaniGrow", 14, 22);
    doc.setFontSize(11);
    doc.text(`Tanggal: ${format(start, 'dd MMMM yyyy')}`, 14, 30);
    doc.text(`Total Insiden Kritis (HIGH Risk): ${totalCritical} kejadian`, 14, 36);

    // Table
    const tableData = Object.keys(hourlyStats).map(hour => {
      const st = hourlyStats[hour];
      return [
        hour,
        st.total > 0 ? `${st.critical} kali` : '-',
        st.total > 0 ? (st.minVpd === 99 ? '-' : `${st.minVpd.toFixed(2)} kPa`) : '-',
        st.critical > 0 ? 'Bahaya' : (st.total > 0 ? 'Aman' : 'Tidak ada data')
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['Jam', 'Frekuensi Kritis (HIGH)', 'VPD Terendah', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68] }
    });

    doc.save(`VaniGrow_Report_${pdfDate}.pdf`);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2332] rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-[#1e2332]">
          <h2 className="font-semibold text-gray-900 dark:text-white">Export & Laporan</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex border-b border-gray-100 dark:border-[#1e2332]">
          <button 
            className={`flex-1 py-3 text-sm font-medium ${tab === 'csv' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
            onClick={() => setTab('csv')}
          >
            Raw Data (CSV)
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium ${tab === 'pdf' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
            onClick={() => setTab('pdf')}
          >
            Daily Report (PDF)
          </button>
        </div>

        <div className="p-5">
          {tab === 'csv' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Unduh data mentah lengkap dari sensor untuk diolah di Excel.</p>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tanggal Mulai</label>
                <input type="date" value={csvStart} onChange={e => setCsvStart(e.target.value)} className="w-full bg-gray-50 dark:bg-[#080b10] border border-gray-200 dark:border-[#1e2332] rounded p-2 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tanggal Akhir</label>
                <input type="date" value={csvEnd} onChange={e => setCsvEnd(e.target.value)} className="w-full bg-gray-50 dark:bg-[#080b10] border border-gray-200 dark:border-[#1e2332] rounded p-2 text-gray-900 dark:text-white text-sm" />
              </div>
              <button 
                onClick={downloadCSV}
                disabled={loading}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Download size={16} /> {loading ? 'Memproses...' : 'Download CSV'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Buat laporan PDF ringkas mengenai insiden kritis pada hari tertentu.</p>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pilih Tanggal</label>
                <input type="date" value={pdfDate} onChange={e => setPdfDate(e.target.value)} className="w-full bg-gray-50 dark:bg-[#080b10] border border-gray-200 dark:border-[#1e2332] rounded p-2 text-gray-900 dark:text-white text-sm" />
              </div>
              <button 
                onClick={downloadPDF}
                disabled={loading}
                className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <FileText size={16} /> {loading ? 'Memproses...' : 'Generate PDF'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
