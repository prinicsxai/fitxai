import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  RefreshControl
} from 'react-native';
import { GeolocationService, GpsError } from '../services/GeolocationService';
import { mobileRequest } from '../services/ApiClient';

interface HomeScreenProps {
  user: any;
}

interface JourneyStatus {
  status: 'NOT_STARTED' | 'ACTIVE' | 'FINISHED';
  statusText: string;
  actionButton: string | null;
  nextType: 'CHECK_IN' | 'CHECK_OUT';
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursWorked: string | null;
  punchesCount: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ user }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [journey, setJourney] = useState<JourneyStatus>({
    status: 'NOT_STARTED',
    statusText: 'NO HAS FICHADO',
    actionButton: 'FICHAR ENTRADA',
    nextType: 'CHECK_IN',
    checkInTime: null,
    checkOutTime: null,
    hoursWorked: null,
    punchesCount: 0,
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gpsPhase, setGpsPhase] = useState<'IDLE' | 'ACQUIRING' | 'SENDING' | 'SUCCESS'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSuccessMessage, setLastSuccessMessage] = useState<string | null>(null);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar estado de la jornada desde el backend
  const loadStatus = useCallback(async () => {
    const res = await mobileRequest('/attendance/my-status');
    if (res.success && res.data) {
      setJourney(res.data);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  };

  // Acción principal: FICHAR
  const handlePunch = async () => {
    setErrorMessage(null);
    setLastSuccessMessage(null);
    setLoading(true);
    setGpsPhase('ACQUIRING');

    try {
      // 1. Obtener ubicación puntual (adquisición única, comprobación de precisión, sensor apagado de inmediato)
      const coords = await GeolocationService.capturePunchLocation();

      setGpsPhase('SENDING');

      // 2. Enviar fichaje al Backend
      const res = await mobileRequest('/attendance/punch', {
        method: 'POST',
        body: JSON.stringify({
          type: journey.nextType,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          altitude: coords.altitude,
        }),
      });

      if (res.success) {
        setGpsPhase('SUCCESS');
        setLastSuccessMessage(
          journey.nextType === 'CHECK_IN'
            ? `Entrada registrada a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
            : `Salida registrada a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
        );
        // Recargar el nuevo estado de la jornada
        await loadStatus();
      } else {
        setErrorMessage(res.error || 'No se pudo guardar el fichaje en el servidor.');
      }
    } catch (err: any) {
      console.warn('[PUNCH_ERROR]', err);
      if (err instanceof GpsError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Error al obtener la ubicación: ' + (err.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
      setTimeout(() => setGpsPhase('IDLE'), 3000);
    }
  };

  const firstName = user?.firstName || user?.first_name || 'Trabajador';

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
    >
      {/* Saludo Personalizado */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {firstName}</Text>
        <Text style={styles.companyTitle}>{user?.companyName || 'FITXAI Mobile'}</Text>
      </View>

      {/* Reloj Digital en Tiempo Real */}
      <View style={styles.clockCard}>
        <Text style={styles.dateText}>
          {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
        <Text style={styles.timeText}>
          {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
      </View>

      {/* Tarjeta de Estado Actual de la Jornada */}
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>ESTADO ACTUAL</Text>
        
        {/* Estado 1: NO HAS FICHADO */}
        {journey.status === 'NOT_STARTED' && (
          <View style={styles.statusBadgeNotStarted}>
            <Text style={styles.statusTextNotStarted}>NO HAS FICHADO</Text>
          </View>
        )}

        {/* Estado 2: JORNADA ACTIVA */}
        {journey.status === 'ACTIVE' && (
          <View style={styles.activeContainer}>
            <View style={styles.statusBadgeActive}>
              <View style={styles.activeDot} />
              <Text style={styles.statusTextActive}>JORNADA ACTIVA</Text>
            </View>
            <View style={styles.timeDetailBox}>
              <Text style={styles.timeDetailLabel}>Entrada registrada:</Text>
              <Text style={styles.timeDetailValue}>{journey.checkInTime || '--:--'}</Text>
            </View>
          </View>
        )}

        {/* Estado 3: JORNADA FINALIZADA */}
        {journey.status === 'FINISHED' && (
          <View style={styles.finishedContainer}>
            <View style={styles.statusBadgeFinished}>
              <Text style={styles.statusTextFinished}>JORNADA FINALIZADA</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Entrada:</Text>
                <Text style={styles.summaryValue}>{journey.checkInTime}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Salida:</Text>
                <Text style={styles.summaryValue}>{journey.checkOutTime}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Horas:</Text>
                <Text style={styles.summaryHours}>{journey.hoursWorked}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Manejo de Errores de GPS / Permisos */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Atención</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handlePunch}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Mensaje de Confirmación Exitoso */}
      {lastSuccessMessage && (
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>{lastSuccessMessage}</Text>
        </View>
      )}

      {/* Botón Principal de Fichaje */}
      {journey.status !== 'FINISHED' && (
        <TouchableOpacity
          style={[
            styles.mainButton,
            journey.nextType === 'CHECK_IN' ? styles.buttonCheckIn : styles.buttonCheckOut,
            loading && styles.buttonDisabled,
          ]}
          onPress={handlePunch}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#090d16" size="small" />
              <Text style={styles.loadingText}>
                {gpsPhase === 'ACQUIRING' && 'Obteniendo GPS puntual...'}
                {gpsPhase === 'SENDING' && 'Guardando fichaje...'}
                {gpsPhase === 'SUCCESS' && '¡Fichaje completado!'}
              </Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.buttonText}>
                {journey.nextType === 'CHECK_IN' ? 'FICHAR ENTRADA' : 'FICHAR SALIDA'}
              </Text>
              <Text style={styles.buttonSubtext}>
                {journey.nextType === 'CHECK_IN' ? 'Registra tu inicio de jornada' : 'Registra tu fin de jornada'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Si la jornada está finalizada, permitir fichar un nuevo turno si hace falta */}
      {journey.status === 'FINISHED' && (
        <TouchableOpacity
          style={[styles.mainButton, styles.buttonSecondary]}
          onPress={handlePunch}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonTextSecondary}>FICHAR NUEVA ENTRADA (Turno Extra)</Text>
        </TouchableOpacity>
      )}

      {/* Aviso de Privacidad y Desconexión del GPS */}
      <View style={styles.privacyNoteBox}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyNoteText}>
          El GPS se activa únicamente durante el segundo en que pulsas el botón y se apaga de inmediato.
          No se registra tu ubicación durante la jornada ni en segundo plano.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  companyTitle: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 2,
  },
  clockCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 18,
  },
  dateText: {
    color: '#94a3b8',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  timeText: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  statusCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 10,
  },
  statusBadgeNotStarted: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  statusTextNotStarted: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeContainer: {
    gap: 12,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  statusTextActive: {
    color: '#34d399',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeDetailBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
  },
  timeDetailLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  timeDetailValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  finishedContainer: {
    gap: 12,
  },
  statusBadgeFinished: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  statusTextFinished: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '800',
  },
  summaryGrid: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  summaryValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryHours: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '800',
  },
  mainButton: {
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonCheckIn: {
    backgroundColor: '#10b981',
  },
  buttonCheckOut: {
    backgroundColor: '#0284c7',
  },
  buttonSecondary: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    alignItems: 'center',
  },
  buttonText: {
    color: '#090d16',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  buttonSubtext: {
    color: 'rgba(9, 13, 22, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  buttonTextSecondary: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#090d16',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 18,
  },
  errorIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  successIcon: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  successText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  privacyNoteBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  privacyIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 2,
  },
  privacyNoteText: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
