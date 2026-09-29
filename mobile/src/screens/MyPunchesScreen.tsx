import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import { mobileRequest } from '../services/ApiClient';

export const MyPunchesScreen: React.FC = () => {
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPunches = async () => {
    const res = await mobileRequest('/attendance/my-punches');
    if (res.success && res.days) {
      setDays(res.days);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPunches();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPunches();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#10b981" size="large" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Mis Fichajes</Text>
        <Text style={styles.subtitle}>Registro histórico personal de jornadas y horas</Text>
      </View>

      {days.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No tienes fichajes registrados</Text>
          <Text style={styles.emptySubtitle}>Tus registros de entrada y salida aparecerán aquí al fichar.</Text>
        </View>
      ) : (
        days.map((day) => (
          <View key={day.date} style={styles.dayCard}>
            {/* Cabecera del Día */}
            <View style={styles.dayHeader}>
              <Text style={styles.dayDate}>{day.formattedDate}</Text>
              <View style={styles.totalHoursBadge}>
                <Text style={styles.totalHoursText}>{day.totalHours} hrs</Text>
              </View>
            </View>

            {/* Entrada */}
            <View style={styles.punchRow}>
              <View style={styles.punchBadgeIn}>
                <Text style={styles.punchBadgeTextIn}>ENTRADA</Text>
              </View>
              <View style={styles.punchDetail}>
                <Text style={styles.punchTime}>{day.checkIn ? day.checkIn.time : 'Sin registrar'}</Text>
                {day.checkIn && day.checkIn.latitude ? (
                  <Text style={styles.locationText}>
                    📍 {day.checkIn.latitude.toFixed(4)}, {day.checkIn.longitude.toFixed(4)} (±{day.checkIn.accuracy ? day.checkIn.accuracy.toFixed(0) : 0}m)
                  </Text>
                ) : (
                  <Text style={styles.noLocationText}>Sin coordenadas</Text>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Salida */}
            <View style={styles.punchRow}>
              <View style={styles.punchBadgeOut}>
                <Text style={styles.punchBadgeTextOut}>SALIDA</Text>
              </View>
              <View style={styles.punchDetail}>
                <Text style={styles.punchTime}>{day.checkOut ? day.checkOut.time : 'Pendiente'}</Text>
                {day.checkOut && day.checkOut.latitude ? (
                  <Text style={styles.locationText}>
                    📍 {day.checkOut.latitude.toFixed(4)}, {day.checkOut.longitude.toFixed(4)} (±{day.checkOut.accuracy ? day.checkOut.accuracy.toFixed(0) : 0}m)
                  </Text>
                ) : (
                  <Text style={styles.noLocationText}>{day.checkOut ? 'Sin coordenadas' : 'En jornada'}</Text>
                )}
              </View>
            </View>
          </View>
        ))
      )}
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
  centerContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  dayCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  dayDate: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  totalHoursBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  totalHoursText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  punchBadgeIn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 12,
    width: 75,
    alignItems: 'center',
  },
  punchBadgeTextIn: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  punchBadgeOut: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 12,
    width: 75,
    alignItems: 'center',
  },
  punchBadgeTextOut: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
  },
  punchDetail: {
    flex: 1,
  },
  punchTime: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  locationText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  noLocationText: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 10,
  },
});
