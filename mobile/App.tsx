import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar 
} from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { MyPunchesScreen } from './src/screens/MyPunchesScreen';
import { 
  MyHoursScreen, 
  IncidentsScreen, 
  ProfileScreen, 
  SettingsScreen 
} from './src/screens/OtherScreens';
import { LoginScreen } from './src/screens/LoginScreen';
import { mobileRequest, setAuthToken } from './src/services/ApiClient';

type MobileTab = 
  | 'home' 
  | 'punches' 
  | 'hours' 
  | 'incidents' 
  | 'profile' 
  | 'settings';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');

  const handleLogout = async () => {
    await mobileRequest('/auth/logout', { method: 'POST' });
    setAuthToken(null);
    setCurrentUser(null);
    setActiveTab('home');
  };

  // Si no ha iniciado sesión, mostrar pantalla de Login
  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#090d16" />
        <LoginScreen onLoginSuccess={(u) => setCurrentUser(u)} />
      </SafeAreaView>
    );
  }

  const tabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Inicio', icon: '⏱️' },
    { id: 'punches', label: 'Mis fichajes', icon: '📋' },
    { id: 'hours', label: 'Mis horas', icon: '⌛' },
    { id: 'incidents', label: 'Incidencias', icon: '⚠️' },
    { id: 'profile', label: 'Mi perfil', icon: '👤' },
    { id: 'settings', label: 'Ajustes', icon: '⚙️' },
  ];

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />
      
      {/* Contenido de la Pantalla Activa */}
      <View style={styles.mainContent}>
        {activeTab === 'home' && <HomeScreen user={currentUser} />}
        {activeTab === 'punches' && <MyPunchesScreen />}
        {activeTab === 'hours' && <MyHoursScreen />}
        {activeTab === 'incidents' && <IncidentsScreen />}
        {activeTab === 'profile' && <ProfileScreen user={currentUser} />}
        {activeTab === 'settings' && <SettingsScreen onLogout={handleLogout} />}
      </View>

      {/* Menú de Navegación Inferior (Tabs) */}
      <View style={styles.bottomNav}>
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(t.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{t.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Botón de Cerrar Sesión en Menú */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🚪</Text>
          <Text style={styles.tabLabelLogout}>Salir</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  mainContent: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    minWidth: 46,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  tabIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#10b981',
  },
  tabLabelLogout: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '700',
  },
});
