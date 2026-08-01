import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { AlertTriangle, Clock } from 'lucide-react';

interface VehicleSpeedCellProps {
  vehicle?: Vehicle;
  hasTelemetry?: boolean;
  showLocationSubtitle?: boolean;
  disabled?: boolean;
}

export const VehicleSpeedCell: React.FC<VehicleSpeedCellProps> = ({
  vehicle,
  hasTelemetry = true,
  showLocationSubtitle = false,
  disabled = false,
}) => {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    // Only update counter timer if vehicle exists and is stopped (speed === 0)
    if (!vehicle || vehicle.speed > 0 || disabled) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [vehicle?.speed, vehicle?.stoppedSince, vehicle?.id, disabled]);

  if (disabled) {
    return <span className="text-slate-400 font-mono text-xs">-</span>;
  }

  if (!hasTelemetry || !vehicle) {
    return <span className="text-slate-400 font-mono text-xs">-</span>;
  }

  // When speed > 0, display speed without counter
  if (vehicle.speed > 0) {
    return (
      <div>
        <span className="font-mono font-bold text-slate-200 block">
          {vehicle.speed} km/h
        </span>
        {showLocationSubtitle && (
          <span className="text-[9px] text-sky-400 font-mono block truncate">
            {vehicle.currentLatitude.toFixed(4)}, {vehicle.currentLongitude.toFixed(4)}
          </span>
        )}
      </div>
    );
  }

  // Speed is 0 km/h -> Compute stopped duration
  const stoppedTimeMs = vehicle.stoppedSince
    ? new Date(vehicle.stoppedSince).getTime()
    : now;

  const elapsedMs = Math.max(0, now - stoppedTimeMs);
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);

  let timeStr = '';
  if (totalMinutes < 60) {
    timeStr = `${totalMinutes}m ${seconds.toString().padStart(2, '0')}s`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    timeStr = `${hours}h ${mins}m`;
  }

  const isOver30Min = totalMinutes >= 30;

  return (
    <div className="flex flex-col items-start">
      <span className="font-mono font-bold text-slate-200 block">
        0 km/h
      </span>
      {showLocationSubtitle && (
        <span className="text-[9px] text-sky-400 font-mono block truncate">
          {vehicle.currentLatitude.toFixed(4)}, {vehicle.currentLongitude.toFixed(4)}
        </span>
      )}

      {/* Counter for stopped vehicle */}
      {isOver30Min ? (
        <div className="mt-1 flex flex-col items-start gap-0.5">
          <span
            className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded text-[9px] font-extrabold animate-pulse font-mono tracking-tight shadow-sm shadow-amber-950/40"
            title="Alerta Torre de Controle: Veículo parado há mais de 30 minutos. Favor orientar o motorista ou verificar o motivo da parada."
          >
            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
            Parado há {timeStr}
          </span>
          <span className="text-[8px] text-amber-400/90 font-extrabold tracking-tight">
            ⚠️ Torre de Controle: Verificar motivo
          </span>
        </div>
      ) : (
        <span className="text-[10px] text-slate-400/90 font-mono inline-flex items-center gap-1 mt-0.5">
          <Clock size={10} className="text-slate-500 shrink-0" />
          Parado há {timeStr}
        </span>
      )}
    </div>
  );
};
