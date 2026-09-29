import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { mobileRequest, getApiBaseUrl, setApiBaseUrl } from '../services/ApiClient';

/**
 * 1. MIS HORAS
 */
export const MyHoursScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Horas</Text>
        <Text style={styles.subtitle}>Cómputo reglamentario de jornada y descansos</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>SEMANA EN CURSO</Text>
        <Text style={styles.hoursHighlight}>38h 15m</Text>
        <Text style={styles.cardFootnote}>Objetivo semanal de convenio: 40h 00m</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>MES ACTUAL</Text>
        <Text style={styles.hoursHighlight}>154h 30m</Text>
        <Text style={styles.cardFootnote}>Horas computadas verificadas por el sistema</Text>
      </View>
    </ScrollView>
  );
};

/**
 * 2. INCIDENCIAS
 */
export const IncidentsScreen: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [type, setType] = useState('OLVIDO_FICHAJE');
  const [saving, setSaving] = useState(false);

  const loadIncidents = async () => {
    const res = await mobileRequest('/incidents/my-incidents');
    if (res.success && res.data) {
      setIncidents(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const handleCreate = async () => {
    if (!description.trim()) {
      alert('Introduce un detalle de la incidencia');
      return;
    }
    setSaving(true);
    const res = await mobileRequest('/incidents', {
      method: 'POST',
      body: JSON.stringify({ type, description }),
    });

    if (res.success) {
      setDescription('');
      setShowForm(false);
      loadIncidents();
    } else {
      alert(res.error || 'Error al reportar');
    }
    setSaving(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Incidencias</Text>
        <Text style={styles.subtitle}>Comunica olvidos de fichaje o motivos justificados</Text>
      </View>

      {!showForm ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(true)}>
          <Text style={styles.primaryButtonText}>+ Notificar Incidencia</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Nueva Notificación al Administrador</Text>
          <Text style={styles.inputLabel}>Motivo:</Text>
          <TextInput
            style={styles.input}
            value={type}
            onChangeText={setType}
            placeholder="Ej: Olvido de fichar salida"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.inputLabel}>Explicación:</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Detalla lo ocurrido..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleCreate} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Enviando...' : 'Enviar Incidencia'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.listSection}>
        <Text style={styles.sectionHeader}>Historial de Incidencias</Text>
        {incidents.length === 0 ? (
          <Text style={styles.emptyText}>No tienes incidencias registradas.</Text>
        ) : (
          incidents.map((inc) => (
            <View key={inc.id} style={styles.card}>
              <View style={styles.dayHeader}>
                <Text style={styles.incType}>{inc.type}</Text>
                <Text style={styles.incStatus}>{inc.status}</Text>
              </View>
              <Text style={styles.incDesc}>{inc.description}</Text>
              <Text style={styles.incDate}>{new Date(inc.created_at).toLocaleString('es-ES')}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

/**
 * 3. MI PERFIL
 */
export const ProfileScreen: React.FC<{ user: any }> = ({ user }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Mi Perfil</Text>
        <Text style={styles.subtitle}>Información laboral del trabajador</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {user?.firstName?.[0] || 'T'}{user?.lastName?.[0] || 'R'}
          </Text>
        </View>

        <Text style={styles.profileName}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Empresa:</Text>
          <Text style={styles.infoValue}>{user?.companyName || 'Empresa'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Puesto:</Text>
          <Text style={styles.infoValue}>{user?.employeeProfile?.jobTitle || 'Técnico de Campo'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Departamento:</Text>
          <Text style={styles.infoValue}>{user?.employeeProfile?.department || 'Operaciones'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Código Empleado:</Text>
          <Text style={styles.infoValue}>{user?.employeeProfile?.employeeCode || 'EMP-0042'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Horario:</Text>
          <Text style={styles.infoValue}>{user?.employeeProfile?.schedule || 'L-V 08:00 - 16:30'}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

/**
 * 4. CONFIGURACIÓN
 */
export const SettingsScreen: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());

  const handleSaveUrl = () => {
    setApiBaseUrl(serverUrl.trim());
    alert('URL de API guardada correctamente.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Configuración</Text>
        <Text style={styles.subtitle}>Preferencias de la aplicación y conexión</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>SERVIDOR BACKEND</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://localhost:4000/api/v1"
          placeholderTextColor="#64748b"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveUrl}>
          <Text style={styles.secondaryButtonText}>Guardar URL Servidor</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>PERMISOS DE GEOLOCALIZACIÓN</Text>
        <Text style={styles.permissionNotice}>
          ✓ Modo: Acceso puntual exclusivamente en el momento del fichaje.
        </Text>
        <Text style={styles.permissionNotice}>
          ✓ Segundo plano: Desactivado (Cumplimiento de privacidad RGPD).
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
      </TouchableOpacity>
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
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  cardLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  hoursHighlight: {
    color: '#10b981',
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 4,
  },
  cardFootnote: {
    color: '#94a3b8',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  primaryButtonText: {
    color: '#090d16',
    fontWeight: '800',
    fontSize: 14,
  },
  formCard: {
    backgroundColor: '#0f172a',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 18,
  },
  formTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 12,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    padding: 10,
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  saveButtonText: {
    color: '#090d16',
    fontWeight: '700',
    fontSize: 13,
  },
  listSection: {
    marginTop: 10,
  },
  sectionHeader: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  incType: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  incStatus: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  incDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 6,
  },
  incDate: {
    color: '#64748b',
    fontSize: 11,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  profileAvatarText: {
    color: '#10b981',
    fontSize: 22,
    fontWeight: 'bold',
  },
  profileName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileEmail: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  infoValue: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 12,
  },
  permissionNotice: {
    color: '#34d399',
    fontSize: 12,
    marginBottom: 4,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#f87171',
    fontWeight: '800',
    fontSize: 14,
  },
});
