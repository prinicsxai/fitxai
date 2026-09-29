import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { mobileRequest, setAuthToken } from '../services/ApiClient';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('carlos.garcia@techlogistics.es');
  const [password, setPassword] = useState('Admin1234!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const res = await mobileRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, platform: 'android' }),
    });

    if (res.success && res.token && res.user) {
      setAuthToken(res.token);
      onLoginSuccess(res.user);
    } else {
      setError(res.error || 'Credenciales inválidas. Comprueba tus datos.');
    }
    setLoading(false);
  };

  const setDemoWorker = () => {
    setEmail('carlos.garcia@techlogistics.es');
    setPassword('Admin1234!');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Brand */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>FX</Text>
          </View>
          <Text style={styles.appName}>FITXAI Mobile</Text>
          <Text style={styles.appTagline}>Portal del Trabajador</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar Sesión</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Correo Corporativo</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="trabajador@empresa.com"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.inputLabel}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#64748b"
          />

          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#090d16" />
            ) : (
              <Text style={styles.loginButtonText}>Acceder a mi Jornada</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.demoButton} onPress={setDemoWorker}>
            <Text style={styles.demoButtonText}>Cargar cuenta de Trabajador Demo</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyBox}>
          <Text style={styles.privacyText}>
            🔒 Geolocalización protegida por RGPD. Tu ubicación solo se consulta en el segundo que pulsas fichar.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  content: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 4,
  },
  logoText: {
    color: '#090d16',
    fontSize: 26,
    fontWeight: '900',
  },
  appName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 18,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#090d16',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  demoButton: {
    alignItems: 'center',
    marginTop: 18,
    padding: 6,
  },
  demoButtonText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  privacyBox: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  privacyText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
