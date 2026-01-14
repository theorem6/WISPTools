/**
 * Login Screen - Firebase Authentication
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';
import { colors } from '../theme/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);

    try {
      // Sign in with Firebase
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      console.log('User logged in:', user.email);

      // Get user's tenant from Firestore
      const userDoc = await firestore()
        .collection('users')
        .doc(user.uid)
        .get();

      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }

      const userData = userDoc.data();
      const tenantId = userData?.tenantId;

      if (!tenantId) {
        throw new Error('No tenant assigned to user');
      }

      // Get tenant info
      const tenantDoc = await firestore()
        .collection('tenants')
        .doc(tenantId)
        .get();

      const tenantData = tenantDoc.data();
      const tenantName = tenantData?.displayName || 'Organization';

      // Save to local storage
      await AsyncStorage.setItem('selectedTenantId', tenantId);
      await AsyncStorage.setItem('tenantName', tenantName);
      await AsyncStorage.setItem('userEmail', user.email || '');

      // Set tenant in API service
      await apiService.setTenantId(tenantId);

      console.log('Logged in as:', tenantName);

      // Navigate to home
      navigation.navigate('Home' as never);
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error.message || 'Invalid credentials'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>📡</Text>
          <Text style={styles.appName}>WISPTools.io</Text>
          <Text style={styles.tagline}>Equipment Tracking & Documentation</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.loginText}>🔐 Login</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          LTE WISP Management Platform
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 30
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50
  },
  logo: {
    fontSize: 80,
    marginBottom: 20
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary
  },
  form: {
    gap: 15
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: colors.textPrimary
  },
  loginButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  loginText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold'
  },
  footer: {
    textAlign: 'center',
    color: colors.textTertiary,
    marginTop: 30,
    fontSize: 12
  }
});



