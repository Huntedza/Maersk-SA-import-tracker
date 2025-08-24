// src/components/ExcelExport.js
import React from 'react';
import { Download } from 'lucide-react';

const ExcelExport = ({ data, filename = 'sa-inbound-schedule', className = '' }) => {
  const exportToCSV = () => {
    if (!data || (!data.allImports && !data.allExports)) {
      console.warn('No data available for export');
      return;
    }

    // Combine imports and exports for export
    const allSchedules = [
      ...(data.allImports || []),
      ...(data.allExports || [])
    ];

    if (allSchedules.length === 0) {
      console.warn('No schedule data to export');
      return;
    }

    // Create CSV headers
    const headers = [
      'Vessel Name',
      'IMO',
      'Service',
      'Port',
      'Port Code',
      'Voyage',
      'Direction',
      'ETA',
      'ETD',
      'ETA Status',
      'ETD Status'
    ];

    // Convert data to CSV rows
    const csvRows = [
      headers.join(','),
      ...allSchedules.map(schedule => [
        `"${schedule.vessel.name}"`,
        `"${schedule.vessel.imo}"`,
        `"${schedule.service.name}"`,
        `"${schedule.port.name}"`,
        `"${schedule.port.code}"`,
        `"${schedule.voyage}"`,
        `"${schedule.direction}"`,
        `"${schedule.schedule.eta.text}"`,
        `"${schedule.schedule.etd.text}"`,
        `"${schedule.schedule.eta.isActual ? 'Actual' : 'Estimated'}"`,
        `"${schedule.schedule.etd.isActual ? 'Actual' : 'Estimated'}"`
      ].join(','))
    ];

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <button
      onClick={exportToCSV}
      className={`flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ${className}`}
    >
      <Download className="h-4 w-4" />
      <span>Export CSV</span>
    </button>
  );
};

export default ExcelExport;