// src/components/ExportDropdown.js
import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

const ExportDropdown = ({ data, filename = 'sa-inbound-schedule', className = '', activeService = null, showDelayedOnly = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Helper function to filter data based on service and delay settings
  const getFilteredData = (serviceFilter = 'all') => {
    if (!data || (!data.allImports && !data.allExports)) {
      return [];
    }

    let allSchedules = [
      ...(data.allImports || []),
      ...(data.allExports || [])
    ];

    // Filter by service if specified
    if (serviceFilter !== 'all' && serviceFilter) {
      allSchedules = allSchedules.filter(schedule => 
        schedule.service?.name === serviceFilter
      );
    }

    // Filter by delayed only if specified
    if (showDelayedOnly) {
      allSchedules = allSchedules.filter(schedule => 
        schedule.delayInfo && schedule.delayInfo.hours > 6
      );
    }

    return allSchedules;
  };

  // CSV/Excel Export with service filtering
  const exportToCSV = (serviceFilter = 'all') => {
    const allSchedules = getFilteredData(serviceFilter);

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

    // Create filename with service filter
    const serviceText = serviceFilter === 'all' ? 'all-services' : serviceFilter.toLowerCase().replace(/\s+/g, '-');
    const delayText = showDelayedOnly ? '-delayed-only' : '';
    const fullFilename = `${filename}-${serviceText}${delayText}-${new Date().toISOString().split('T')[0]}.csv`;

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fullFilename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setIsOpen(false);
  };

  // PDF Export with service filtering
  const exportToPDF = (serviceFilter = 'all') => {
    const allSchedules = getFilteredData(serviceFilter);

    if (allSchedules.length === 0) {
      console.warn('No schedule data to export to PDF');
      return;
    }

    // Create HTML content for PDF
    const currentDate = new Date().toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });

    const serviceTitle = serviceFilter === 'all' ? 'All Services' : `${serviceFilter} Service`;
    const delayFilter = showDelayedOnly ? ' (Delayed Vessels Only)' : '';
    const reportTitle = `🚢 SA Import Schedule Report - ${serviceTitle}${delayFilter}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>SA Import Schedule Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #2563eb;
              margin: 0;
              font-size: 24px;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 6px;
              text-align: left;
            }
            th {
              background-color: #f8fafc;
              font-weight: bold;
              color: #374151;
              font-size: 10px;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .delayed-minor {
              background-color: #fef3c7 !important;
              border-left: 3px solid #f59e0b;
            }
            .delayed-major {
              background-color: #fee2e2 !important;
              border-left: 3px solid #ef4444;
            }
            .summary {
              margin-bottom: 20px;
              padding: 15px;
              background-color: #eff6ff;
              border-radius: 8px;
              border-left: 4px solid #2563eb;
              font-size: 12px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #9ca3af;
              border-top: 1px solid #e5e7eb;
              padding-top: 15px;
            }
            .actions {
              position: fixed;
              top: 20px;
              right: 20px;
              background: white;
              padding: 15px;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              z-index: 1000;
            }
            .btn {
              display: inline-block;
              padding: 8px 16px;
              margin: 0 5px;
              background: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
              border: none;
            }
            .btn:hover {
              background: #1d4ed8;
            }
            .btn-secondary {
              background: #6b7280;
            }
            .btn-secondary:hover {
              background: #4b5563;
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
              table { page-break-inside: auto; }
              .actions { display: none; }
            }
          </style>
          <script>
            function downloadPDF() {
              // Hide the action buttons
              document.querySelector('.actions').style.display = 'none';
              
              // Use browser's print functionality to save as PDF
              window.print();
              
              // Show buttons again after print dialog
              setTimeout(() => {
                const actions = document.querySelector('.actions');
                if (actions) actions.style.display = 'block';
              }, 1000);
            }
            
            function printReport() {
              document.querySelector('.actions').style.display = 'none';
              window.print();
              setTimeout(() => {
                const actions = document.querySelector('.actions');
                if (actions) actions.style.display = 'block';
              }, 1000);
            }
          </script>
        </head>
        <body>
          <div class="actions">
            <button class="btn" onclick="downloadPDF()">💾 Save as PDF</button>
            <button class="btn btn-secondary" onclick="printReport()">🖨️ Print</button>
            <button class="btn btn-secondary" onclick="window.close()">✖️ Close</button>
          </div>

          <div class="header">
            <h1>${reportTitle}</h1>
            <p><strong>Generated:</strong> ${currentDate}</p>
            <p><strong>Total Vessels:</strong> ${allSchedules.length}</p>
            ${serviceFilter !== 'all' ? `<p><strong>Service:</strong> ${serviceFilter}</p>` : ''}
            ${showDelayedOnly ? '<p><strong>Filter:</strong> Delayed vessels only</p>' : ''}
          </div>

          <div class="summary">
            <strong>Report Summary:</strong> This report contains vessel arrival and departure information for SA ports including Cape Town, Durban, Port Elizabeth, and Port Coega.
            <br><br>
            <strong>Delay Legend:</strong> 
            <span style="background: #fef3c7; padding: 2px 6px; border-left: 3px solid #f59e0b; margin: 0 5px;">Minor delays (6-24 hours)</span>
            <span style="background: #fee2e2; padding: 2px 6px; border-left: 3px solid #ef4444; margin: 0 5px;">Major delays (>24 hours)</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Vessel Name</th>
                <th>IMO</th>
                <th>Service</th>
                <th>Port</th>
                <th>Voyage</th>
                <th>ETA</th>
                <th>ETD</th>
                <th>ETA Status</th>
                <th>Delays</th>
              </tr>
            </thead>
            <tbody>
              ${allSchedules.map(schedule => {
                const delayClass = schedule.delayInfo 
                  ? (schedule.delayInfo.hours > 24 ? 'delayed-major' : 'delayed-minor')
                  : '';
                return `
                <tr class="${delayClass}">
                  <td>${schedule.vessel.name}</td>
                  <td>${schedule.vessel.imo}</td>
                  <td>${schedule.service.name}</td>
                  <td>${schedule.port.name}</td>
                  <td>${schedule.voyage}</td>
                  <td>${schedule.schedule.eta.text}</td>
                  <td>${schedule.schedule.etd.text}</td>
                  <td>${schedule.schedule.eta.isActual ? 'Actual' : 'Estimated'}</td>
                  <td>${schedule.delayInfo ? `<strong>+${schedule.delayInfo.hours}h</strong>` : 'On Time'}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>Generated by SA Inbound Tracker • ${new Date().toISOString()}</p>
          </div>
        </body>
      </html>
    `;

    // Create blob and open in new window with action buttons
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Open in new window with save/print options
    const newWindow = window.open(url, '_blank', 'width=1200,height=800');
    if (!newWindow) {
      // Fallback: create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}-report-${new Date().toISOString().split('T')[0]}.html`;
      link.click();
      URL.revokeObjectURL(url);
    }

    setIsOpen(false);
  };

  const getExportOptions = () => {
    const options = [];
    
    // Current service options (if a service is selected)
    if (activeService) {
      options.push(
        {
          label: `Excel/CSV - ${activeService} Only`,
          icon: FileSpreadsheet,
          onClick: () => exportToCSV(activeService),
          description: `Export ${activeService} service data only`,
          className: 'text-blue-600 dark:text-blue-400'
        },
        {
          label: `PDF - ${activeService} Only`,
          icon: FileText,
          onClick: () => exportToPDF(activeService),
          description: `Print-ready PDF for ${activeService} service`,
          className: 'text-blue-600 dark:text-blue-400'
        }
      );
    }
    
    // All services options
    options.push(
      {
        label: 'Excel/CSV - All Services',
        icon: FileSpreadsheet,
        onClick: () => exportToCSV('all'),
        description: 'Download complete schedule data',
        className: 'text-gray-600 dark:text-gray-400'
      },
      {
        label: 'PDF - All Services',
        icon: FileText,
        onClick: () => exportToPDF('all'),
        description: 'Complete PDF report with all services',
        className: 'text-gray-600 dark:text-gray-400'
      }
    );
    
    return options;
  };

  const exportOptions = getExportOptions();

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <Download className="h-4 w-4" />
        <span>Export</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            <div className="py-2">
              {activeService && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Current Service ({activeService})
                  </div>
                </div>
              )}
              
              {exportOptions.slice(0, activeService ? 2 : 0).map((option, index) => (
                <button
                  key={index}
                  onClick={option.onClick}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-start space-x-3 transition-colors"
                >
                  <option.icon className={`h-5 w-5 mt-0.5 ${option.className || 'text-gray-400 dark:text-gray-500'}`} />
                  <div>
                    <div className={`font-medium text-sm ${option.className || 'text-gray-900 dark:text-white'}`}>
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {option.description}
                    </div>
                  </div>
                </button>
              ))}

              {activeService && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    All Services
                  </div>
                </div>
              )}

              {exportOptions.slice(activeService ? 2 : 0).map((option, index) => (
                <button
                  key={index + (activeService ? 2 : 0)}
                  onClick={option.onClick}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-start space-x-3 transition-colors"
                >
                  <option.icon className={`h-5 w-5 mt-0.5 ${option.className || 'text-gray-400 dark:text-gray-500'}`} />
                  <div>
                    <div className={`font-medium text-sm ${option.className || 'text-gray-900 dark:text-white'}`}>
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {option.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportDropdown;