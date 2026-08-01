import { Vehicle, Driver, Geofence, Trip, CteInfo, Product, Contract, MaintenanceRecord } from '../types';

const API_BASE = '/api';

async function handleJsonResponse<T>(res: Response, fallbackErrorMsg: string): Promise<T> {
  if (!res.ok) {
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const err = await res.json();
        throw new Error(err.error || fallbackErrorMsg);
      }
    } catch (e: any) {
      if (e.message) throw e;
    }
    throw new Error(fallbackErrorMsg);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Servidor em manutenção ou reiniciando (resposta não-JSON recebida).');
  }

  return res.json() as Promise<T>;
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const res = await fetch(`${API_BASE}/vehicles`);
  return handleJsonResponse<Vehicle[]>(res, 'Erro ao buscar veículos');
}

export async function createVehicle(data: { licensePlate: string; model: string }): Promise<Vehicle> {
  const res = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Vehicle>(res, 'Erro ao criar veículo');
}

export async function updateVehicle(id: string, data: { licensePlate: string; model: string }): Promise<Vehicle> {
  const res = await fetch(`${API_BASE}/vehicles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Vehicle>(res, 'Erro ao atualizar veículo');
}

export async function deleteVehicle(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/vehicles/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Erro ao deletar veículo');
}

export async function updateVehicleMaintenance(
  id: string,
  data: {
    inMaintenance: boolean;
    maintenanceReason?: string | null;
    maintenanceExpectedDate?: string | null;
  }
): Promise<Vehicle> {
  const res = await fetch(`${API_BASE}/vehicles/${id}/maintenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Vehicle>(res, 'Erro ao atualizar manutenção do veículo');
}

export async function blockVehicle(id: string, block: boolean): Promise<Vehicle> {
  const res = await fetch(`${API_BASE}/vehicles/${id}/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ block }),
  });
  return handleJsonResponse<Vehicle>(res, 'Erro ao bloquear veículo');
}

export async function toggleVehicleVisibility(id: string, visibleOnMap: boolean): Promise<Vehicle> {
  const res = await fetch(`${API_BASE}/vehicles/${id}/visibility`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visibleOnMap }),
  });
  return handleJsonResponse<Vehicle>(res, 'Erro ao alterar visibilidade do veículo');
}

export async function updateDriverName(id: string, driverName: string | null): Promise<Vehicle> {
  const res = await fetch(`${API_BASE}/vehicles/${id}/driverName`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverName }),
  });
  return handleJsonResponse<Vehicle>(res, 'Erro ao atualizar motorista do veículo');
}

export async function updateVehicleManualLocation(id: string, manualLocation: string | null): Promise<Vehicle> {
  const res = await fetch(`${API_BASE}/vehicles/${id}/manual-location`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manualLocation }),
  });
  return handleJsonResponse<Vehicle>(res, 'Erro ao atualizar localização manual do veículo');
}

export async function fetchMaintenance(): Promise<MaintenanceRecord[]> {
  const res = await fetch(`${API_BASE}/maintenance`);
  return handleJsonResponse<MaintenanceRecord[]>(res, 'Erro ao buscar histórico de manutenção');
}

export async function fetchDrivers(): Promise<Driver[]> {
  const res = await fetch(`${API_BASE}/drivers`);
  return handleJsonResponse<Driver[]>(res, 'Erro ao buscar motoristas');
}

export async function createDriver(data: { name: string; cpf: string; phone?: string; licenseNumber?: string }): Promise<Driver> {
  const res = await fetch(`${API_BASE}/drivers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Driver>(res, 'Erro ao criar motorista');
}

export async function updateDriver(id: string, data: { name?: string; cpf?: string; phone?: string; licenseNumber?: string }): Promise<Driver> {
  const res = await fetch(`${API_BASE}/drivers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Driver>(res, 'Erro ao atualizar motorista');
}

export async function fetchGeofences(): Promise<Geofence[]> {
  const res = await fetch(`${API_BASE}/geofences`);
  return handleJsonResponse<Geofence[]>(res, 'Erro ao buscar geocercas');
}

export async function createGeofence(data: { name: string; latitude: number; longitude: number; radius: number; type: string; icon?: string; shapeType?: string; polygonCoordinates?: { latitude: number; longitude: number }[] }): Promise<Geofence> {
  const res = await fetch(`${API_BASE}/geofences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Geofence>(res, 'Erro ao criar geocerca');
}

export async function updateGeofence(id: string, data: { name?: string; latitude?: number; longitude?: number; radius?: number; type?: string; icon?: string; shapeType?: string; polygonCoordinates?: { latitude: number; longitude: number }[] }): Promise<Geofence> {
  const res = await fetch(`${API_BASE}/geofences/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Geofence>(res, 'Erro ao atualizar geocerca');
}

export async function deleteGeofence(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/geofences/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao deletar geocerca');
}

export async function fetchTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_BASE}/trips`);
  return handleJsonResponse<Trip[]>(res, 'Erro ao buscar viagens');
}

export async function createTrip(data: { vehicleId: string; driverId: string; originGeofenceId: string; destinationGeofenceId: string; scheduledLoadingDate?: string; productId?: string }): Promise<Trip> {
  const res = await fetch(`${API_BASE}/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Trip>(res, 'Erro ao criar viagem');
}

export async function updateTrip(id: string, data: { vehicleId?: string; driverId?: string; originGeofenceId?: string; destinationGeofenceId?: string; scheduledLoadingDate?: string; productId?: string; contractId?: string; loadedVolumeM3?: number }): Promise<Trip> {
  const res = await fetch(`${API_BASE}/trips/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Trip>(res, 'Erro ao atualizar viagem');
}

export async function deleteTrip(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/trips/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Erro ao deletar viagem');
}

export async function resetTrip(id: string): Promise<Trip> {
  const res = await fetch(`${API_BASE}/trips/${id}/reset`, { method: 'POST' });
  return handleJsonResponse<Trip>(res, 'Erro ao resetar viagem');
}

export async function uploadCteToTrip(id: string, cteInfo: CteInfo): Promise<Trip> {
  const res = await fetch(`${API_BASE}/trips/${id}/cte`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cteInfo }),
  });
  return handleJsonResponse<Trip>(res, 'Erro ao vincular CT-e');
}

export async function updateTripStatus(id: string, status: string): Promise<Trip> {
  const res = await fetch(`${API_BASE}/trips/${id}/update-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return handleJsonResponse<Trip>(res, 'Erro ao atualizar status da viagem');
}

export async function callSascarSoap(method: string, params: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/sascar-soap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro na requisição SOAP Sascar');
  }
  return res.json();
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/products`);
  return handleJsonResponse<Product[]>(res, 'Erro ao buscar produtos');
}

export async function createProduct(data: { name: string; code?: string; description?: string }): Promise<Product> {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Product>(res, 'Erro ao criar produto');
}

export async function updateProduct(id: string, data: { name?: string; code?: string; description?: string }): Promise<Product> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Product>(res, 'Erro ao atualizar produto');
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Erro ao deletar produto');
  }
}

export async function fetchContracts(): Promise<Contract[]> {
  const res = await fetch(`${API_BASE}/contracts`);
  return handleJsonResponse<Contract[]>(res, 'Erro ao buscar contratos');
}

export async function createContract(data: { clientName: string; cnpj: string; volumeM3: number; startDate: string; endDate: string; status?: string }): Promise<Contract> {
  const res = await fetch(`${API_BASE}/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Contract>(res, 'Erro ao criar contrato');
}

export async function updateContract(id: string, data: { clientName?: string; cnpj?: string; volumeM3?: number; startDate?: string; endDate?: string; status?: string }): Promise<Contract> {
  const res = await fetch(`${API_BASE}/contracts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleJsonResponse<Contract>(res, 'Erro ao atualizar contrato');
}

export async function deleteContract(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/contracts/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Erro ao deletar contrato');
  }
}

