import React, { useState, useMemo } from 'react';
import { Vehicle, Trip } from '../types';
import { 
  Truck, Plus, CheckCircle, ShieldAlert, Radio, Eye, EyeOff, 
  Edit2, Trash2, X, Route, Search, Printer, FileSpreadsheet, Filter, 
  Wrench, AlertTriangle, CheckCircle2, RotateCcw, MapPin, Activity, Sliders, FileText
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatLocationDisplay } from '../utils/geocoding';
import { copyCoordinates } from '../utils/clipboard';

interface VehiclesProps {
  vehicles: Vehicle[];
  trips: Trip[];
  onCreateVehicle: (data: { licensePlate: string; model: string }) => void;
  onUpdateVehicle?: (id: string, data: { licensePlate: string; model: string }) => void;
  onDeleteVehicle?: (id: string) => void;
  onToggleVisibility?: (id: string, visible: boolean) => void;
  onUpdateDriverName?: (id: string, name: string | null) => void;
  onToggleRoute?: (id: string) => void;
  selectedRouteVehicleId?: string | null;
  onOpenRotograma?: (trip: Trip) => void;
}

type StatusFilter = 'ALL' | 'EN_ROUTE' | 'AVAILABLE' | 'MAINTENANCE' | 'ALERT';
type TelemetryFilter = 'ALL' | 'SASCAR' | 'NO_TELEMETRY';
type VisibilityFilter = 'VISIBLE_ONLY' | 'HIDDEN_ONLY' | 'ALL';

export default function Vehicles({
  vehicles,
  trips,
  onCreateVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onToggleVisibility,
  onUpdateDriverName,
  onToggleRoute,
  selectedRouteVehicleId,
  onOpenRotograma,
}: VehiclesProps) {
  const [licensePlate, setLicensePlate] = useState('');
  const [model, setModel] = useState('');
  
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState('');
  
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editLicensePlate, setEditLicensePlate] = useState('');
  const [editModel, setEditModel] = useState('');

  // Filters state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [telemetryFilter, setTelemetryFilter] = useState<TelemetryFilter>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('VISIBLE_ONLY');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Helper to identify SASCAR vehicles vs non-SASCAR
  const isSascarVehicle = (vehicle?: Vehicle): boolean => {
    if (!vehicle || !vehicle.licensePlate) return false;
    const plate = vehicle.licensePlate;
    const modelStr = vehicle.model?.toUpperCase() || '';
    if (plate === 'CUF6F40' || plate === 'RMO2J80') return false;
    if (modelStr.includes('SIGHRA') || modelStr.includes('SIGHA')) return false;
    return true;
  };

  // KPI Calculations
  const totalVehicles = vehicles.length;
  const countVisible = useMemo(() => vehicles.filter(v => v.visibleOnMap !== false).length, [vehicles]);
  const countHidden = useMemo(() => vehicles.filter(v => v.visibleOnMap === false).length, [vehicles]);
  const countAvailable = useMemo(() => vehicles.filter(v => v.status === 'AVAILABLE' && v.visibleOnMap !== false).length, [vehicles]);
  const countEnRoute = useMemo(() => vehicles.filter(v => v.status === 'EN_ROUTE' && v.visibleOnMap !== false).length, [vehicles]);
  const countMaintenance = useMemo(() => vehicles.filter(v => v.status === 'MAINTENANCE' && v.visibleOnMap !== false).length, [vehicles]);
  const countAlert = useMemo(() => vehicles.filter(v => v.status === 'ALERT' && v.visibleOnMap !== false).length, [vehicles]);
  const countSascar = useMemo(() => vehicles.filter(v => isSascarVehicle(v) && v.visibleOnMap !== false).length, [vehicles]);
  const countNoTelemetry = useMemo(() => vehicles.filter(v => !isSascarVehicle(v) && v.visibleOnMap !== false).length, [vehicles]);

  // Filtered vehicles list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // Visibility Filter (default to VISIBLE_ONLY)
      if (visibilityFilter === 'VISIBLE_ONLY' && v.visibleOnMap === false) return false;
      if (visibilityFilter === 'HIDDEN_ONLY' && v.visibleOnMap !== false) return false;

      // Status Filter
      if (statusFilter === 'EN_ROUTE' && v.status !== 'EN_ROUTE') return false;
      if (statusFilter === 'AVAILABLE' && v.status !== 'AVAILABLE') return false;
      if (statusFilter === 'MAINTENANCE' && v.status !== 'MAINTENANCE') return false;
      if (statusFilter === 'ALERT' && v.status !== 'ALERT') return false;

      // Telemetry Filter
      const hasSascar = isSascarVehicle(v);
      if (telemetryFilter === 'SASCAR' && !hasSascar) return false;
      if (telemetryFilter === 'NO_TELEMETRY' && hasSascar) return false;

      // Search Term
      if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        const matchPlate = v.licensePlate.toLowerCase().includes(lower);
        const matchModel = v.model.toLowerCase().includes(lower);
        const matchDriver = v.driverName ? v.driverName.toLowerCase().includes(lower) : false;
        if (!matchPlate && !matchModel && !matchDriver) return false;
      }

      return true;
    });
  }, [vehicles, visibilityFilter, statusFilter, telemetryFilter, searchTerm]);

  // Filtered vehicles list for reports (excluding hidden on map)
  const reportVehicles = useMemo(() => {
    return filteredVehicles.filter(v => v.visibleOnMap !== false);
  }, [filteredVehicles]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!licensePlate.trim() || !model.trim()) return;

    onCreateVehicle({
      licensePlate: licensePlate.toUpperCase(),
      model,
    });

    setLicensePlate('');
    setModel('');
  };

  // CSV Export Action
  const handleExportCSV = () => {
    const headers = [
      'Placa',
      'Modelo/Descrição',
      'Motorista Vinculado',
      'Status',
      'Velocidade (km/h)',
      'Telemetria SASCAR',
      'Localização Atual',
      'Última Transmissão SASCAR',
      'Visível no Mapa'
    ];

    const rows = reportVehicles.map(v => {
      const hasSascar = isSascarVehicle(v);
      const loc = formatLocationDisplay(v.manualLocation, v.currentLatitude, v.currentLongitude);
      const speed = hasSascar ? `${v.speed} km/h` : 'Sem Telemetria (-)';
      const sascarStatus = hasSascar ? 'Ativa (SASCAR)' : 'Sem Telemetria (Sighra/Outros)';
      const statusText = v.status === 'AVAILABLE' ? 'Disponível' :
                        v.status === 'EN_ROUTE' ? 'Em Viagem' :
                        v.status === 'ALERT' ? 'Com Alerta' :
                        v.status === 'MAINTENANCE' ? 'Em Manutenção' :
                        v.status === 'BLOCKED' ? 'Bloqueado' : v.status;
      const driver = v.driverName || 'Não vinculado';
      const lastTrans = new Date(v.telemetryTime).toLocaleString('pt-BR');
      const visible = v.visibleOnMap === false ? 'Não' : 'Sim';

      return [
        v.licensePlate,
        v.model,
        driver,
        statusText,
        speed,
        sascarStatus,
        loc,
        lastTrans,
        visible
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_telemetria_veiculos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate PDF document via jsPDF
  const handleGeneratePDF = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const currentDateStr = new Date().toLocaleString('pt-BR');
      const isoDateStr = new Date().toISOString().slice(0, 10);

      // Title & Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text('SISTEMA DE MONITORAMENTO DE FROTA', 14, 14);

      doc.setFontSize(10);
      doc.setTextColor(2, 132, 199);
      doc.text('Relatório Geral de Veículos & Telemetria SASCAR', 14, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Emissão: ${currentDateStr}`, 283, 14, { align: 'right' });
      doc.text(`Total Exibido: ${reportVehicles.length} veículos`, 283, 20, { align: 'right' });

      // Header divider line
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.5);
      doc.line(14, 24, 283, 24);

      // KPI Summary Section
      let y = 29;
      const kpis = [
        { label: 'TOTAL FROTA', val: totalVehicles, color: [15, 23, 42] },
        { label: 'EM VIAGEM', val: countEnRoute, color: [2, 132, 199] },
        { label: 'DISPONÍVEIS', val: countAvailable, color: [22, 163, 74] },
        { label: 'MANUTENÇÃO', val: countMaintenance, color: [220, 38, 38] },
        { label: 'ALERTAS', val: countAlert, color: [217, 119, 6] },
        { label: 'SASCAR ATIVA', val: countSascar, color: [79, 70, 229] }
      ];

      const boxWidth = 42;
      const boxHeight = 13;
      kpis.forEach((kpi, idx) => {
        const x = 14 + idx * 45;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, boxWidth, boxHeight, 1.5, 1.5, 'FD');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + boxWidth / 2, y + 4.5, { align: 'center' });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.text(String(kpi.val), x + boxWidth / 2, y + 10.5, { align: 'center' });
      });

      // Table Setup
      y = 48;
      const headers = [
        { name: 'Placa', x: 16 },
        { name: 'Motorista Vinculado', x: 42 },
        { name: 'Status', x: 102 },
        { name: 'Telemetria SASCAR', x: 142 },
        { name: 'Localização Atual', x: 182 }
      ];

      // Draw Table Header
      doc.setFillColor(226, 232, 240);
      doc.rect(14, y, 269, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      headers.forEach(h => doc.text(h.name, h.x, y + 5));

      y += 7;

      reportVehicles.forEach((v, index) => {
        if (y > 190) {
          doc.addPage('a4', 'l');
          y = 15;
          doc.setFillColor(226, 232, 240);
          doc.rect(14, y, 269, 7, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          headers.forEach(h => doc.text(h.name, h.x, y + 5));
          y += 7;
        }

        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y, 269, 6.5, 'F');
        }

        const hasSascar = isSascarVehicle(v);
        const loc = formatLocationDisplay(v.manualLocation, v.currentLatitude, v.currentLongitude);
        const activeTrip = trips.find(t => t.vehicleId === v.id && t.status !== 'DELIVERED');
        
        let statusText = '';
        let statusColor: [number, number, number] = [15, 23, 42];

        if (v.status === 'MAINTENANCE') {
          statusText = 'MANUTENÇÃO';
          statusColor = [220, 38, 38];
        } else if (activeTrip) {
          if (activeTrip.status === 'SCHEDULED') {
            statusText = activeTrip.transitStarted ? 'TRÂNSITO / VAZIO' : 'AGENDADO';
            statusColor = activeTrip.transitStarted ? [217, 119, 6] : [79, 70, 229];
          } else if (activeTrip.status === 'WAITING_LOADING') {
            statusText = 'NO CARREGAMENTO';
            statusColor = [249, 115, 22];
          } else if (activeTrip.status === 'EN_ROUTE') {
            statusText = 'EM TRÂNSITO';
            statusColor = [2, 132, 199];
          } else if (activeTrip.status === 'WAITING_UNLOADING') {
            statusText = 'NO DESCARREGAMENTO';
            statusColor = [168, 85, 247];
          } else {
            statusText = 'CONCLUÍDA';
            statusColor = [22, 163, 74];
          }
        } else {
          if (v.status === 'AVAILABLE') {
            statusText = 'DISPONÍVEL';
            statusColor = [22, 163, 74];
          } else if (v.status === 'MAINTENANCE') {
            statusText = 'MANUTENÇÃO';
            statusColor = [220, 38, 38];
          } else if (v.status === 'BLOCKED') {
            statusText = 'BLOQUEADO';
            statusColor = [220, 38, 38];
          } else if (v.status === 'ALERT') {
            statusText = 'COM ALERTA';
            statusColor = [217, 119, 6];
          } else if (v.status === 'EN_ROUTE') {
            statusText = 'EM VIAGEM';
            statusColor = [2, 132, 199];
          } else {
            statusText = v.status;
          }
        }

        const sascarText = hasSascar ? 'SASCAR Ativa' : 'Sem Telemetria';

        doc.setTextColor(15, 23, 42);
        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.text(v.licensePlate, 16, y + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text((v.driverName || 'Não vinculado').slice(0, 28), 42, y + 4.5);
        
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(statusText, 102, y + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(sascarText, 142, y + 4.5);
        doc.text(loc.slice(0, 50), 182, y + 4.5);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.1);
        doc.line(14, y + 6.5, 283, y + 6.5);

        y += 6.5;
      });

      const filename = `Relatorio_Veiculos_Telemetria_${isoDateStr}.pdf`;
      doc.save(filename);

      try {
        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 4000);
      } catch (e) {
        console.warn('Blob backup note:', e);
      }

    } catch (err) {
      console.error('Error generating PDF:', err);
      handlePrintReport();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Print Action via Popup Window (or PDF backup)
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      handleGeneratePDF();
      return;
    }

    const rowsHtml = reportVehicles.map(v => {
      const hasSascar = isSascarVehicle(v);
      const loc = formatLocationDisplay(v.manualLocation, v.currentLatitude, v.currentLongitude);
      const activeTrip = trips.find(t => t.vehicleId === v.id && t.status !== 'DELIVERED');
      
      let statusText = '';
      let statusColor = '#0f172a';

      if (v.status === 'MAINTENANCE') {
        statusText = 'MANUTENÇÃO';
        statusColor = '#dc2626';
      } else if (activeTrip) {
        if (activeTrip.status === 'SCHEDULED') {
          statusText = activeTrip.transitStarted ? 'TRÂNSITO / VAZIO' : 'AGENDADO';
          statusColor = activeTrip.transitStarted ? '#d97706' : '#4f46e5';
        } else if (activeTrip.status === 'WAITING_LOADING') {
          statusText = 'NO CARREGAMENTO';
          statusColor = '#f97316';
        } else if (activeTrip.status === 'EN_ROUTE') {
          statusText = 'EM TRÂNSITO';
          statusColor = '#0284c7';
        } else if (activeTrip.status === 'WAITING_UNLOADING') {
          statusText = 'NO DESCARREGAMENTO';
          statusColor = '#a855f7';
        } else {
          statusText = 'CONCLUÍDA';
          statusColor = '#16a34a';
        }
      } else {
        if (v.status === 'AVAILABLE') {
          statusText = 'DISPONÍVEL';
          statusColor = '#16a34a';
        } else if (v.status === 'MAINTENANCE') {
          statusText = 'MANUTENÇÃO';
          statusColor = '#dc2626';
        } else if (v.status === 'BLOCKED') {
          statusText = 'BLOQUEADO';
          statusColor = '#dc2626';
        } else if (v.status === 'ALERT') {
          statusText = 'COM ALERTA';
          statusColor = '#d97706';
        } else if (v.status === 'EN_ROUTE') {
          statusText = 'EM VIAGEM';
          statusColor = '#0284c7';
        } else {
          statusText = v.status;
        }
      }

      const sascarText = hasSascar ? 'SASCAR Ativa' : 'Sem Telemetria';

      return `
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${v.licensePlate}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${v.driverName || 'Não vinculado'}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: ${statusColor};">${statusText}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${sascarText}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${loc}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatorio_Geral_Veiculos_${new Date().toISOString().slice(0, 10)}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 16px;
            color: #0f172a;
            background: #ffffff;
            font-size: 11px;
          }
          .no-print-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #0f172a;
            color: white;
            padding: 10px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
          }
          .no-print-bar button {
            background: #0284c7;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-size: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .title {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 12px;
            color: #0284c7;
            font-weight: 700;
            margin-top: 2px;
            text-transform: uppercase;
          }
          .info {
            text-align: right;
            font-size: 10px;
            color: #475569;
            line-height: 1.4;
          }
          .kpi-container {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
            margin-bottom: 16px;
          }
          .kpi-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 8px;
            border-radius: 6px;
            text-align: center;
          }
          .kpi-label {
            font-size: 8px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
          }
          .kpi-value {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          th {
            background: #e2e8f0;
            color: #1e293b;
            padding: 7px 6px;
            border: 1px solid #cbd5e1;
            text-transform: uppercase;
            font-size: 9px;
            font-weight: 700;
            text-align: left;
          }
          td {
            padding: 6px;
            border: 1px solid #cbd5e1;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <strong>Relatório de Frota Pronto para Impressão / Salvar PDF</strong>
          </div>
          <button onclick="window.print()">Imprimir / Salvar em PDF</button>
        </div>

        <div class="header">
          <div>
            <div class="title">Sistema de Monitoramento de Frota</div>
            <div class="subtitle">Relatório Geral de Veículos & Telemetria SASCAR</div>
          </div>
          <div class="info">
            <p><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Total de Veículos Exibidos:</strong> ${reportVehicles.length}</p>
          </div>
        </div>

        <div class="kpi-container">
          <div class="kpi-box">
            <div class="kpi-label">Total Frota</div>
            <div class="kpi-value">${totalVehicles}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Em Viagem</div>
            <div class="kpi-value" style="color: #0284c7;">${countEnRoute}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Disponíveis</div>
            <div class="kpi-value" style="color: #16a34a;">${countAvailable}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Manutenção</div>
            <div class="kpi-value" style="color: #dc2626;">${countMaintenance}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Com Alerta</div>
            <div class="kpi-value" style="color: #d97706;">${countAlert}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">SASCAR Ativa</div>
            <div class="kpi-value" style="color: #4f46e5;">${countSascar}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Placa</th>
              <th>Motorista Vinculado</th>
              <th>Status</th>
              <th>Telemetria SASCAR</th>
              <th>Localização Atual</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setTelemetryFilter('ALL');
    setVisibilityFilter('VISIBLE_ONLY');
    setSearchTerm('');
  };

  return (
    <div className="space-y-5">
      {/* 1. REPORT HEADER & KPIS SUMMARY */}
      <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 print:hidden space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1f2d45]/60 pb-3">
          <div>
            <h1 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Truck size={18} className="text-sky-400" />
              Relatório Geral de Veículos & Telemetria
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Visão geral da frota de caminhões, com rastreamento SASCAR, localização e status operacional
            </p>
          </div>

          {/* Quick Export Actions */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={handleGeneratePDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer shadow-md disabled:opacity-50"
              title="Gerar e Baixar arquivo PDF do Relatório"
            >
              {isGeneratingPdf ? (
                <>
                  <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-3.5 h-3.5 mr-1" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <FileText size={14} />
                  <span>Gerar PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1a2236] hover:bg-slate-700 text-slate-200 border border-[#1f2d45] transition-colors cursor-pointer"
              title="Imprimir Relatório Formatado ou Salvar em PDF"
            >
              <Printer size={14} className="text-sky-400" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-lg shadow-emerald-950/20"
              title="Exportar em Excel (CSV) com telemetria e localização"
            >
              <FileSpreadsheet size={14} />
              <span>Exportar Excel (CSV)</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Total */}
          <div 
            onClick={handleResetFilters}
            className={`bg-[#0a0e1a] border p-3 rounded-lg cursor-pointer transition-all ${
              statusFilter === 'ALL' && telemetryFilter === 'ALL' ? 'border-sky-500/60 bg-sky-950/20' : 'border-[#1f2d45] hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Frota</span>
              <Truck size={14} className="text-sky-400" />
            </div>
            <p className="text-xl font-mono font-extrabold text-white">{totalVehicles}</p>
            <p className="text-[9px] text-slate-500">Caminhões cadastrados</p>
          </div>

          {/* Em Viagem */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'EN_ROUTE' ? 'ALL' : 'EN_ROUTE')}
            className={`bg-[#0a0e1a] border p-3 rounded-lg cursor-pointer transition-all ${
              statusFilter === 'EN_ROUTE' ? 'border-sky-500 bg-sky-500/10' : 'border-[#1f2d45] hover:border-sky-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-sky-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Em Viagem</span>
              <Activity size={14} />
            </div>
            <p className="text-xl font-mono font-extrabold text-sky-400">{countEnRoute}</p>
            <p className="text-[9px] text-slate-500">Em trânsito ativo</p>
          </div>

          {/* Disponíveis */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}
            className={`bg-[#0a0e1a] border p-3 rounded-lg cursor-pointer transition-all ${
              statusFilter === 'AVAILABLE' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#1f2d45] hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Disponíveis</span>
              <CheckCircle2 size={14} />
            </div>
            <p className="text-xl font-mono font-extrabold text-emerald-400">{countAvailable}</p>
            <p className="text-[9px] text-slate-500">Prontos para carga</p>
          </div>

          {/* Em Manutenção */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'MAINTENANCE' ? 'ALL' : 'MAINTENANCE')}
            className={`bg-[#0a0e1a] border p-3 rounded-lg cursor-pointer transition-all ${
              statusFilter === 'MAINTENANCE' ? 'border-rose-500 bg-rose-500/10' : 'border-[#1f2d45] hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-rose-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Manutenção</span>
              <Wrench size={14} />
            </div>
            <p className="text-xl font-mono font-extrabold text-rose-400">{countMaintenance}</p>
            <p className="text-[9px] text-slate-500">Bloqueados / Oficina</p>
          </div>

          {/* Com Alerta */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'ALERT' ? 'ALL' : 'ALERT')}
            className={`bg-[#0a0e1a] border p-3 rounded-lg cursor-pointer transition-all ${
              statusFilter === 'ALERT' ? 'border-amber-500 bg-amber-500/10' : 'border-[#1f2d45] hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Com Alerta</span>
              <AlertTriangle size={14} />
            </div>
            <p className="text-xl font-mono font-extrabold text-amber-400">{countAlert}</p>
            <p className="text-[9px] text-slate-500">Atenção requerida</p>
          </div>

          {/* Telemetria Sascar */}
          <div 
            onClick={() => setTelemetryFilter(telemetryFilter === 'SASCAR' ? 'ALL' : 'SASCAR')}
            className={`bg-[#0a0e1a] border p-3 rounded-lg cursor-pointer transition-all ${
              telemetryFilter === 'SASCAR' ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#1f2d45] hover:border-indigo-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-indigo-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Telemetria SASCAR</span>
              <Radio size={14} />
            </div>
            <p className="text-xl font-mono font-extrabold text-indigo-300">{countSascar} <span className="text-[11px] text-slate-500 font-normal">/ {totalVehicles}</span></p>
            <p className="text-[9px] text-slate-500">{countNoTelemetry} sem SASCAR</p>
          </div>
        </div>
      </div>

      {/* 2. FILTERS & SEARCH BAR */}
      <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-3.5 print:hidden space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 mr-1">
              <Filter size={13} className="text-sky-400" />
              Status:
            </span>
            {[
              { id: 'ALL', label: 'Todos', count: totalVehicles },
              { id: 'EN_ROUTE', label: 'Em Viagem', count: countEnRoute, color: 'text-sky-400' },
              { id: 'AVAILABLE', label: 'Disponíveis', count: countAvailable, color: 'text-emerald-400' },
              { id: 'MAINTENANCE', label: 'Em Manutenção', count: countMaintenance, color: 'text-rose-400' },
              { id: 'ALERT', label: 'Com Alerta', count: countAlert, color: 'text-amber-400' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  statusFilter === tab.id
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-[#0a0e1a] text-slate-400 border-[#1f2d45] hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1 rounded bg-[#161f30] ${tab.color || 'text-slate-300'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Telemetry Filter & Visibility Filter & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs bg-[#0a0e1a] border border-[#1f2d45] px-2.5 py-1 rounded-lg">
              {visibilityFilter === 'HIDDEN_ONLY' ? <EyeOff size={13} className="text-amber-400" /> : <Eye size={13} className="text-sky-400" />}
              <label className="text-[10px] font-bold text-slate-400 uppercase">Exibição:</label>
              <select
                value={visibilityFilter}
                onChange={e => setVisibilityFilter(e.target.value as VisibilityFilter)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="VISIBLE_ONLY" className="bg-[#111827]">Apenas Visíveis no Sistema ({countVisible})</option>
                <option value="HIDDEN_ONLY" className="bg-[#111827]">Ocultos no Mapa ({countHidden})</option>
                <option value="ALL" className="bg-[#111827]">Todos os Veículos ({totalVehicles})</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs bg-[#0a0e1a] border border-[#1f2d45] px-2.5 py-1 rounded-lg">
              <Radio size={13} className="text-indigo-400" />
              <label className="text-[10px] font-bold text-slate-400 uppercase">Telemetria SASCAR:</label>
              <select
                value={telemetryFilter}
                onChange={e => setTelemetryFilter(e.target.value as TelemetryFilter)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#111827]">Todas</option>
                <option value="SASCAR" className="bg-[#111827]">Com Telemetria SASCAR ({countSascar})</option>
                <option value="NO_TELEMETRY" className="bg-[#111827]">Sem SASCAR / Sighra ({countNoTelemetry})</option>
              </select>
            </div>

            {(statusFilter !== 'ALL' || telemetryFilter !== 'ALL' || visibilityFilter !== 'VISIBLE_ONLY' || searchTerm) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white bg-[#1a2236] hover:bg-slate-700 transition cursor-pointer"
                title="Limpar todos os filtros"
              >
                <RotateCcw size={12} />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT: REGISTRATION + VEHICLES LIST */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 print:hidden">
        {/* Registration Column */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Plus size={15} className="text-sky-400" />
              Novo Veículo (Frota)
            </h2>
            <p className="text-[10px] text-slate-400 leading-snug">
              Cadastre os caminhões de tração que farão parte do sistema e transmitirão telemetria Sascar.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Placa do Veículo</label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={e => setLicensePlate(e.target.value)}
                  placeholder="Ex: ABC1D23 ou BRA3S45"
                  required
                  maxLength={8}
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Modelo / Descrição Completa</label>
                <input
                  type="text"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="Ex: Scania R 450 (Caminhão Trator)"
                  required
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-500 transition text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus size={13} />
                Adicionar Veículo
              </button>
            </form>
          </div>
        </div>

        {/* Vehicles Fleet List */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Veículos na Frota</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#1a2236] text-sky-400 font-bold border border-sky-500/20">
                {filteredVehicles.length} exibidos
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Buscar placa, modelo ou motorista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111827] border border-[#1f2d45] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {filteredVehicles.length === 0 ? (
            <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-8 text-center text-slate-400 space-y-2">
              <Truck size={32} className="mx-auto text-slate-600" />
              <p className="text-xs font-bold uppercase tracking-wider">Nenhum veículo encontrado</p>
              <p className="text-[11px] text-slate-500">Tente ajustar os filtros de busca ou status acima.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVehicles.map(v => {
                const hasSascar = isSascarVehicle(v);
                return (
                  <div key={v.id} className="bg-[#111827] border border-[#1f2d45] rounded-xl p-3.5 space-y-2.5 relative overflow-hidden">
                    {/* Telemetry line effect */}
                    <div className={`absolute top-0 left-0 right-0 h-[2px] ${hasSascar ? 'bg-sky-500/60' : 'bg-slate-600/40'}`} />

                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5 max-w-[65%]">
                        {editingVehicleId === v.id ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={editLicensePlate}
                              onChange={e => setEditLicensePlate(e.target.value.toUpperCase())}
                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-sky-500/50 uppercase font-mono font-bold"
                              maxLength={8}
                              placeholder="Placa"
                            />
                            <input
                              type="text"
                              value={editModel}
                              onChange={e => setEditModel(e.target.value)}
                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-sky-500/50"
                              placeholder="Modelo"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-bold text-slate-200 block truncate" title={v.driverName ? `${v.licensePlate} - ${v.driverName}` : v.licensePlate}>
                                {v.licensePlate}{v.driverName ? ` - ${v.driverName}` : ''}
                              </span>
                              {!hasSascar && (
                                <span className="text-[8px] font-mono font-bold px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                  SEM SASCAR
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-none truncate">{v.model}</p>
                          </>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${
                          v.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          v.status === 'EN_ROUTE' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                          v.status === 'ALERT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {v.status === 'AVAILABLE' ? 'DISPONÍVEL' :
                           v.status === 'EN_ROUTE' ? 'EM VIAGEM' :
                           v.status === 'ALERT' ? 'ALERTA' :
                           v.status === 'MAINTENANCE' ? 'MANUTENÇÃO' :
                           v.status === 'BLOCKED' ? 'BLOQUEADO' : v.status}
                        </span>
                        
                        {/* Edit/Delete Icons */}
                        <div className="flex gap-1.5">
                          {editingVehicleId === v.id ? (
                            <>
                              <button
                                onClick={() => {
                                  if (onUpdateVehicle && editLicensePlate.trim() && editModel.trim()) {
                                    onUpdateVehicle(v.id, {
                                      licensePlate: editLicensePlate.toUpperCase().trim(),
                                      model: editModel.trim()
                                    });
                                  }
                                  setEditingVehicleId(null);
                                }}
                                className="p-1 text-emerald-400 hover:bg-[#1a2236] rounded transition cursor-pointer"
                                title="Salvar alterações"
                              >
                                <CheckCircle size={13} />
                              </button>
                              <button
                                onClick={() => setEditingVehicleId(null)}
                                className="p-1 text-rose-400 hover:bg-[#1a2236] rounded transition cursor-pointer"
                                title="Cancelar"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingVehicleId(v.id);
                                  setEditLicensePlate(v.licensePlate);
                                  setEditModel(v.model);
                                }}
                                className="p-1 text-sky-400 hover:bg-[#1a2236] rounded transition cursor-pointer"
                                title="Editar Veículo"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => onDeleteVehicle?.(v.id)}
                                className="p-1 text-rose-500 hover:bg-[#1a2236] rounded transition cursor-pointer"
                                title="Excluir Veículo"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-[#1f2d45]/40 pt-2 text-slate-400">
                      <div className="space-y-0.5">
                        <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wide">Velocidade:</span>
                        <p className="text-slate-300 font-bold">
                          {hasSascar ? `${v.speed} km/h` : '-'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wide">Motorista:</span>
                          {onUpdateDriverName && editingDriverId !== v.id && (
                            <button onClick={() => {
                              setEditingDriverId(v.id);
                              setEditDriverName(v.driverName || '');
                            }} className="text-sky-400 hover:text-sky-300">
                              <Edit2 size={10} />
                            </button>
                          )}
                        </div>
                        {editingDriverId === v.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editDriverName}
                              onChange={e => setEditDriverName(e.target.value)}
                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-sky-500/50 h-5"
                              placeholder="Nome"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onUpdateDriverName?.(v.id, editDriverName.trim() || null);
                                  setEditingDriverId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingDriverId(null);
                                }
                              }}
                            />
                            <button 
                              onClick={() => {
                                onUpdateDriverName?.(v.id, editDriverName.trim() || null);
                                setEditingDriverId(null);
                              }}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <CheckCircle size={12} />
                            </button>
                          </div>
                        ) : (
                          <p className="text-slate-300 truncate font-bold" title={v.driverName || 'Não vinculado'}>
                            {v.driverName ? v.driverName.split(' ').slice(0, 2).join(' ') : 'Não vinculado'}
                          </p>
                        )}
                      </div>
                      
                      <div className="col-span-2 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wide">Localização Atual:</span>
                          <button
                            type="button"
                            onClick={() => copyCoordinates(v.currentLatitude, v.currentLongitude, v.licensePlate)}
                            className="p-0.5 text-sky-400 hover:text-sky-300 hover:bg-sky-500/20 rounded transition cursor-pointer flex items-center gap-1 text-[9px] font-semibold"
                            title="Clique para copiar latitude e longitude (Lat, Lng)"
                          >
                            <MapPin size={11} />
                            <span className="text-[8px] underline">Copiar Coordenadas</span>
                          </button>
                        </div>
                        <p className="text-slate-300 font-sans text-[10px] truncate" title={formatLocationDisplay(v.manualLocation, v.currentLatitude, v.currentLongitude)}>
                          {formatLocationDisplay(v.manualLocation, v.currentLatitude, v.currentLongitude)}
                        </p>
                      </div>

                      <div className="col-span-2 space-y-0.5">
                        <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wide">Última Transmissão Sascar:</span>
                        <p className="text-sky-400 font-bold text-[9px] truncate">
                          {new Date(v.telemetryTime).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {/* Status footer warnings */}
                    {v.status === 'BLOCKED' && (
                      <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-[9px] text-rose-400 flex items-center gap-1 font-sans">
                        <ShieldAlert size={11} className="flex-shrink-0" />
                        <span>Bloqueio ativo remoto (Válvula de combustível fechada).</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-[#1f2d45]/40">
                      {onToggleRoute && (
                        <button
                          onClick={() => {
                            const activeTrip = trips?.find(t => t.vehicleId === v.id && t.status !== 'DELIVERED');
                            if (activeTrip && onOpenRotograma) {
                              onOpenRotograma(activeTrip);
                            } else {
                              onToggleRoute(v.id);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold transition-colors ${
                            selectedRouteVehicleId === v.id
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <Route size={12} />
                          <span>{selectedRouteVehicleId === v.id ? 'Ocultar Rota' : 'Ver Rota'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => onToggleVisibility && onToggleVisibility(v.id, v.visibleOnMap === false ? true : false)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold transition-colors ${
                          v.visibleOnMap === false
                            ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            : 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20'
                        }`}
                      >
                        {v.visibleOnMap === false ? (
                          <>
                            <EyeOff size={12} />
                            <span>Oculto no Mapa</span>
                          </>
                        ) : (
                          <>
                            <Eye size={12} />
                            <span>Visível no Mapa</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. PRINTABLE REPORT FORMATTED (Shown only when printing) */}
      <div className="hidden print:block p-6 text-black bg-white space-y-5 font-sans">
        <div className="flex justify-between items-start border-b border-gray-400 pb-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight uppercase">SISTEMA DE MONITORAMENTO DE FROTA</h1>
            <h2 className="text-sm font-bold text-gray-700 uppercase">Relatório Geral de Veículos & Telemetria SASCAR</h2>
          </div>
          <div className="text-right text-xs">
            <p><span className="font-bold">Data de Emissão:</span> {new Date().toLocaleString('pt-BR')}</p>
            <p><span className="font-bold">Total de Veículos na Listagem:</span> {reportVehicles.length}</p>
          </div>
        </div>

        {/* Print Summary Table */}
        <div className="grid grid-cols-6 gap-2 text-center text-xs border border-gray-300 p-2 rounded bg-gray-50">
          <div>
            <p className="font-bold text-gray-500 text-[10px]">TOTAL FROTA</p>
            <p className="text-sm font-extrabold">{totalVehicles}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 text-[10px]">EM VIAGEM</p>
            <p className="text-sm font-extrabold">{countEnRoute}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 text-[10px]">DISPONÍVEIS</p>
            <p className="text-sm font-extrabold">{countAvailable}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 text-[10px]">MANUTENÇÃO</p>
            <p className="text-sm font-extrabold">{countMaintenance}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 text-[10px]">ALERTAS</p>
            <p className="text-sm font-extrabold">{countAlert}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 text-[10px]">SASCAR ATIVA</p>
            <p className="text-sm font-extrabold">{countSascar}</p>
          </div>
        </div>

        {/* Print Vehicles Table */}
        <table className="w-full text-left text-[11px] border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-200 border-b border-gray-400 uppercase text-[10px] font-bold">
              <th className="p-1.5 border border-gray-400">Placa</th>
              <th className="p-1.5 border border-gray-400">Motorista Vinculado</th>
              <th className="p-1.5 border border-gray-400">Status</th>
              <th className="p-1.5 border border-gray-400">Telemetria SASCAR</th>
              <th className="p-1.5 border border-gray-400">Localização Atual</th>
            </tr>
          </thead>
          <tbody>
            {reportVehicles.map(v => {
              const hasSascar = isSascarVehicle(v);
              const loc = formatLocationDisplay(v.manualLocation, v.currentLatitude, v.currentLongitude);
              const activeTrip = trips.find(t => t.vehicleId === v.id && t.status !== 'DELIVERED');
              
              let statusText = '';
              let statusColorClass = 'text-slate-900';

              if (v.status === 'MAINTENANCE') {
                statusText = 'MANUTENÇÃO';
                statusColorClass = 'text-red-600';
              } else if (activeTrip) {
                if (activeTrip.status === 'SCHEDULED') {
                  statusText = activeTrip.transitStarted ? 'TRÂNSITO / VAZIO' : 'AGENDADO';
                  statusColorClass = activeTrip.transitStarted ? 'text-amber-600' : 'text-indigo-600';
                } else if (activeTrip.status === 'WAITING_LOADING') {
                  statusText = 'NO CARREGAMENTO';
                  statusColorClass = 'text-orange-600';
                } else if (activeTrip.status === 'EN_ROUTE') {
                  statusText = 'EM TRÂNSITO';
                  statusColorClass = 'text-sky-600';
                } else if (activeTrip.status === 'WAITING_UNLOADING') {
                  statusText = 'NO DESCARREGAMENTO';
                  statusColorClass = 'text-purple-600';
                } else {
                  statusText = 'CONCLUÍDA';
                  statusColorClass = 'text-emerald-600';
                }
              } else {
                if (v.status === 'AVAILABLE') {
                  statusText = 'DISPONÍVEL';
                  statusColorClass = 'text-emerald-600';
                } else if (v.status === 'MAINTENANCE') {
                  statusText = 'MANUTENÇÃO';
                  statusColorClass = 'text-red-600';
                } else if (v.status === 'BLOCKED') {
                  statusText = 'BLOQUEADO';
                  statusColorClass = 'text-red-600';
                } else if (v.status === 'ALERT') {
                  statusText = 'COM ALERTA';
                  statusColorClass = 'text-amber-600';
                } else if (v.status === 'EN_ROUTE') {
                  statusText = 'EM VIAGEM';
                  statusColorClass = 'text-sky-600';
                } else {
                  statusText = v.status;
                }
              }

              return (
                <tr key={v.id} className="border-b border-gray-300 odd:bg-white even:bg-gray-50">
                  <td className="p-1.5 border border-gray-300 font-mono font-bold">{v.licensePlate}</td>
                  <td className="p-1.5 border border-gray-300">{v.driverName || 'Não vinculado'}</td>
                  <td className={`p-1.5 border border-gray-300 font-bold ${statusColorClass}`}>
                    {statusText}
                  </td>
                  <td className="p-1.5 border border-gray-300">
                    {hasSascar ? 'SASCAR Ativa' : 'Sem Telemetria (Sighra/Outros)'}
                  </td>
                  <td className="p-1.5 border border-gray-300 text-[10px]">{loc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

