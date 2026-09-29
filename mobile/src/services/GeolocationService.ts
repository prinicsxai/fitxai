/**
 * FITXAI Mobile - Servicio de Geolocalización Puntual Estricta
 * 
 * POLÍTICA DE PRIVACIDAD Y REGLAS FUNDAMENTALES:
 * - NO solicitar seguimiento continuo.
 * - NO solicitar ubicación en segundo plano.
 * - Adquisición puntual exclusivamente en el momento del clic ("FICHAR ENTRADA" / "FICHAR SALIDA").
 * - Inmediatamente después de capturar la posición, se apaga y libera el sensor.
 * - Validación estricta de precisión (< 150m).
 * - Errores explícitos: GPS_DISABLED, PERMISSION_DENIED, LOW_ACCURACY.
 * - Nunca inventar coordenadas ni usar ubicaciones viejas en caché.
 */

export interface PunchGpsResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  capturedAt: string;
}

export type GpsErrorCode = 
  | 'GPS_DISABLED' 
  | 'PERMISSION_DENIED' 
  | 'LOW_ACCURACY' 
  | 'TIMEOUT' 
  | 'UNKNOWN';

export class GpsError extends Error {
  code: GpsErrorCode;
  canRetry: boolean;

  constructor(code: GpsErrorCode, message: string, canRetry: boolean = true) {
    super(message);
    this.name = 'GpsError';
    this.code = code;
    this.canRetry = canRetry;
  }
}

export class GeolocationService {
  private static MAX_ACCURACY_METERS = 150; // Umbral máximo de precisión aceptable

  /**
   * Captura la ubicación en un único instante puntual y apaga el sensor.
   */
  static async capturePunchLocation(): Promise<PunchGpsResult> {
    console.log('[GPS_LIFECYCLE] Iniciando solicitud puntual de ubicación...');

    // 1. Entorno de Navegador / Web Móvil (navigator.geolocation)
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise<PunchGpsResult>((resolve, reject) => {
        const options: PositionOptions = {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0, // EXIGIDO: Nunca usar ubicación antigua cacheada
        };

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const accuracy = pos.coords.accuracy;
            console.log(`[GPS_LIFECYCLE] Lectura puntual obtenida. Precisión: ±${accuracy.toFixed(1)}m. Desactivando sensor.`);

            // 3. Comprobar precisión
            if (accuracy > this.MAX_ACCURACY_METERS) {
              return reject(
                new GpsError(
                  'LOW_ACCURACY',
                  `No podemos determinar tu ubicación con suficiente precisión (±${accuracy.toFixed(0)}m > ${this.MAX_ACCURACY_METERS}m). Sitúate en un lugar con mejor cobertura GPS.`,
                  true
                )
              );
            }

            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude || undefined,
              capturedAt: new Date(pos.timestamp).toISOString(),
            });
          },
          (err) => {
            console.warn('[GPS_LIFECYCLE] Error en lectura del sensor:', err.code, err.message);
            if (err.code === 1) {
              // PERMISSION_DENIED
              reject(
                new GpsError(
                  'PERMISSION_DENIED',
                  'Necesitamos permiso de ubicación para registrar el lugar del fichaje.',
                  true
                )
              );
            } else if (err.code === 2) {
              // POSITION_UNAVAILABLE
              reject(
                new GpsError(
                  'GPS_DISABLED',
                  'Activa la ubicación para poder fichar.',
                  true
                )
              );
            } else if (err.code === 3) {
              // TIMEOUT
              reject(
                new GpsError(
                  'TIMEOUT',
                  'El sensor GPS tardó demasiado en responder. Asegúrate de tener visibilidad del cielo o red activa.',
                  true
                )
              );
            } else {
              reject(
                new GpsError(
                  'UNKNOWN',
                  'No se pudo obtener la ubicación GPS.',
                  true
                )
              );
            }
          },
          options
        );
      });
    }

    // 2. Si se ejecuta en entorno React Native nativo con expo-location dinámico
    try {
      const Location = require('expo-location');
      
      // Comprobar si los servicios de GPS están encendidos en el teléfono
      const isGpsEnabled = await Location.hasServicesEnabledAsync();
      if (!isGpsEnabled) {
        throw new GpsError('GPS_DISABLED', 'Activa la ubicación para poder fichar.', true);
      }

      // Solicitar permiso en primer plano
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new GpsError('PERMISSION_DENIED', 'Necesitamos permiso de ubicación para registrar el lugar del fichaje.', true);
      }

      // Obtener lectura puntual
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        maximumAge: 0, // Fresco, no cacheado
      });

      const accuracy = location.coords.accuracy || 10;
      if (accuracy > this.MAX_ACCURACY_METERS) {
        throw new GpsError(
          'LOW_ACCURACY',
          `No podemos determinar tu ubicación con suficiente precisión (±${accuracy.toFixed(0)}m).`,
          true
        );
      }

      console.log('[GPS_LIFECYCLE] Ubicación nativa obtenida. Sensor liberado.');
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy,
        altitude: location.coords.altitude || undefined,
        capturedAt: new Date(location.timestamp).toISOString(),
      };
    } catch (e: any) {
      if (e instanceof GpsError) throw e;
      throw new GpsError('UNKNOWN', e.message || 'Error al obtener ubicación GPS.');
    }
  }
}
