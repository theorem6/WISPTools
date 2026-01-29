/**
 * WISP Field App - Mobile Equipment Scanner
 * React Native app for field technicians
 * Uses React Navigation; Plans, Notifications, PlanDetails and all routes wired in AppNavigator.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import auth from '@react-native-firebase/auth';
import AppNavigator from './src/navigation/AppNavigator';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading WISP Field App...</Text>
      </View>
    );
  }

  const initialRouteName = user ? 'Home' : 'Login';
  return <AppNavigator initialRouteName={initialRouteName} />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007bff',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 12,
  },
});

export default App;
