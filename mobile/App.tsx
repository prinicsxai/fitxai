import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { GeolocationService, PunchCoordinates } from './src/services/GeolocationService';

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'IDLE' | 'ACQUIRING' | 'RELEASED'>('IDLE');
  const [lastPunch, setLastPunch] = useState<{
    type: 'ENTRADA' | 'SALIDA';
    timestamp: string;
    coords: PunchCoordinates;
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePunch = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    try {
      setLoading(true);
      setGpsStatus('ACQUIRING');

      // 1. Obtener ubicación puntual instantánea
      const coords = await GeolocationService.captureLocationOnce();
      
      // 2. Apagar sensor GPS de inmediato
      setGpsStatus('RELEASED');

      // 3. Registrar el fichaje
      setLastPunch({
        type: type === 'CHECK_IN' ? 'ENTRADA' : 'SALIDA',
        timestamp: new Date().toLocaleTimeString('es-ES'),
        coords,
      });

      // Simular breve notificación y volver a reposo
      setTimeout(() => {
        setGpsStatus('IDLE');
      }, 4000);
    } catch (err: any) {
      alert('Error al fichar: ' + err.message);
      setGpsStatus('IDLE');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* Cabecera de la App */}
        <View style={styles.header}>
          <Text style={styles.appName}>FITXAI</Text>
          <Text style={styles.appSubtitle}>Control de Asistencia del Trabajador</Text>
        </View>

        {/* Tarjeta del Trabajador */}
        <View style={styles.workerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>CG</Text>
          </View>
          <View style={styles.workerInfo}>
            <Text style={styles.workerName}>Carlos García</Text>
            <Text style={styles.workerRole}>Técnico de Campo · DNI: 48765432X</Text>
            <Text style={styles.companyName}>Tech Logistics Iberia S.L.</Text>
          </View>
        </View>

        {/* Reloj Digital en Tiempo Real */}
        <View style={styles.clockCard}>
          <Text style={styles.dateText}>
            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Text style={styles.timeText}>
            {currentTime.toLocaleTimeString('es-ES')}
          </Text>
          
          {/* Indicador de Estado GPS */}
          <View style={styles.gpsBadge}>
            <View style={[styles.gpsDot, gpsStatus === 'ACQUIRING' ? styles.dotActive : styles.dotIdle]} />
            <Text style={styles.gpsText}>
              {gpsStatus === 'IDLE' && 'GPS: Inactivo (En reposo)'}
              {gpsStatus === 'ACQUIRING' && 'GPS: Obteniendo ubicación puntual...'}
              {gpsStatus === 'RELEASED' && 'GPS: Apagado y liberado'}
            </Text>
          </View>
        </View>

        {/* Botones Principales de Fichaje */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.punchButton, styles.checkInButton, loading && styles.disabledButton]} 
            onPress={() => handlePunch('CHECK_IN')}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading && gpsStatus === 'ACQUIRING' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonIcon}>🟢</Text>
                <Text style={styles.punchButtonText}>FICHAR ENTRADA</Text>
                <Text style={styles.punchButtonSubtext}>Inicio de jornada laboral</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.punchButton, styles.checkOutButton, loading && styles.disabledButton]} 
            onPress={() => handlePunch('CHECK_OUT')}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading && gpsStatus === 'ACQUIRING' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonIcon}>🔴</Text>
                <Text style={styles.punchButtonText}>FICHAR SALIDA</Text>
                <Text style={styles.punchButtonSubtext}>Fin de jornada laboral</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tarjeta de Confirmación de Último Fichaje */}
        {lastPunch && (
          <View style={styles.lastPunchCard}>
            <Text style={styles.lastPunchTitle}>✅ Último Fichaje Registrado</Text>
            <View style={styles.lastPunchRow}>
              <Text style={styles.lastPunchLabel}>Tipo:</Text>
              <Text style={styles.lastPunchValue}>{lastPunch.type}</Text>
            </View>
            <View style={styles.lastPunchRow}>
              <Text style={styles.lastPunchLabel}>Hora exacta:</Text>
              <Text style={styles.lastPunchValue}>{lastPunch.timestamp}</Text>
            </View>
            <View style={styles.lastPunchRow}>
              <Text style={styles.lastPunchLabel}>Coordenadas:</Text>
              <Text style={styles.lastPunchValue}>
                {lastPunch.coords.latitude.toFixed(5)}, {lastPunch.coords.longitude.toFixed(5)}
              </Text>
            </View>
            <View style={styles.lastPunchRow}>
              <Text style={styles.lastPunchLabel}>Precisión GPS:</Text>
              <Text style={styles.lastPunchValue}>±{lastPunch.coords.accuracy.toFixed(1)} metros</Text>
            </View>
            <Text style={styles.privacyNote}>
              🔒 La ubicación ha sido guardada. El sensor GPS se ha apagado inmediatamente para garantizar tu privacidad.
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  scroll: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  workerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
  },
  workerRole: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  companyName: {
    color: '#34d399',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  clockCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  dateText: {
    color: '#94a3b8',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  timeText: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 1,
    marginVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotIdle: {
    backgroundColor: '#64748b',
  },
  dotActive: {
    backgroundColor: '#10b981',
  },
  gpsText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 24,
  },
  punchButton: {
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  checkInButton: {
    backgroundColor: '#059669',
  },
  checkOutButton: {
    backgroundColor: '#0284c7',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  punchButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  punchButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  lastPunchCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#059669',
  },
  lastPunchTitle: {
    color: '#34d399',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  lastPunchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  lastPunchLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  lastPunchValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  privacyNote: {
    color: '#6ee7b7',
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    padding: 8,
    borderRadius: 8,
  },
});
