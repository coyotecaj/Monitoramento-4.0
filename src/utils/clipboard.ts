export function showToast(message: string, submessage?: string, type: 'success' | 'info' | 'error' = 'success') {
  window.dispatchEvent(
    new CustomEvent('app-toast', {
      detail: { message, submessage, type },
    })
  );
}

export function copyCoordinates(lat?: number | null, lng?: number | null, label?: string) {
  if (lat === undefined || lat === null || lng === undefined || lng === null || (lat === 0 && lng === 0)) {
    showToast('Coordenadas Indisponíveis', 'Não foi possível obter a latitude e longitude deste local.', 'error');
    return;
  }

  const coordsFormatted = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  navigator.clipboard.writeText(coordsFormatted).then(
    () => {
      const title = label ? `Coordenadas (${label})` : 'Coordenadas Copiadas!';
      showToast(title, `Lat/Lng: ${coordsFormatted} (Copiado!)`, 'success');
    },
    () => {
      // Fallback if permission fails
      const title = label ? `Coordenadas (${label})` : 'Coordenadas!';
      showToast(title, `Lat/Lng: ${coordsFormatted}`, 'info');
    }
  );
}
