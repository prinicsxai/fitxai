/**
 * Servicio de Geolocalización Web para FITXAI
 * 
 * REGLAS ESTRICTAS DE PRIVACIDAD:
 * 1. NO EXISTE SEGUIMIENTO GPS CONTINUO.
 * 2. NO existe watchPosition ni polling periódico.
 * 3. NO se ejecuta en segundo plano.
 * 4. La ubicación se obtiene ÚNICAMENTE bajo demanda cuando el usuario pulsa:
 *    "FICHAR ENTRADA" o "FICHAR SALIDA".
 * 5. Inmediatamente tras la captura puntual, el sensor GPS del dispositivo se libera.
 */

export interface PunchCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  isMocked?: boolean;
}

export interface GeolocationResult {
  success: boolean;
  coords?: PunchCoordinates;
  error?: string;
  code?: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'UNKNOWN';
}

/**
 * Capturar la posición GPS actual del navegador de forma estrictamente puntual.
 */
export async function getWebPunchPosition(): Promise<GeolocationResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return {
      success: false,
      error: 'Tu navegador o dispositivo no soporta la API de geolocalización web.',
      code: 'NOT_SUPPORTED',
    };
  }

  return new Promise((resolve) => {
    // navigator.geolocation.getCurrentPosition ejecuta una única lectura y detiene el sensor
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, altitude } = position.coords;

        // Comprobación de coordenadas válidas
        if (latitude === 0 && longitude === 0) {
          resolve({
            success: false,
            error: 'Coordenadas nulas detectadas (0,0). Por favor, asegúrate de tener señal GPS válida.',
            code: 'POSITION_UNAVAILABLE',
          });
          return;
        }

        resolve({
          success: true,
          coords: {
            latitude,
            longitude,
            accuracy: Math.round(accuracy * 10) / 10,
            altitude: altitude !== null ? Math.round(altitude) : undefined,
            isMocked: false,
          },
        });
      },
      (error) => {
        let userMessage = 'Error desconocido al acceder a la ubicación.';
        let code: GeolocationResult['code'] = 'UNKNOWN';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            userMessage =
              'Has denegado el permiso de ubicación en tu navegador. Para registrar tu jornada según la normativa laboral, activa el permiso de ubicación en los ajustes del navegador y pulsa "Reintentar".';
            code = 'PERMISSION_DENIED';
            break;
          case error.POSITION_UNAVAILABLE:
            userMessage =
              'No se ha podido obtener la señal GPS de tu dispositivo. Asegúrate de tener los servicios de ubicación o GPS activados en el teléfono/ordenador.';
            code = 'POSITION_UNAVAILABLE';
            break;
          case error.TIMEOUT:
            userMessage =
              'Tiempo de espera agotado al intentar capturar la posición GPS. Comprueba que no estás en un sótano o zona sin cobertura satelital/wifi.';
            code = 'TIMEOUT';
            break;
        }

        resolve({
          success: false,
          error: userMessage,
          code,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0, // Nunca reutilizar caché de posición antigua
      }
    );
  });
}
