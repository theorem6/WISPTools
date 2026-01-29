/**
 * Notifications Screen (§4 – field app notification polling + UI)
 * Lists project approvals and other notifications from backend GET /api/notifications
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: { projectId?: string; projectName?: string };
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.getNotifications();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load notifications:', e);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const markRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      await apiService.markNotificationRead(item.id);
      setList((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
    } catch (e) {
      Alert.alert('Error', 'Could not mark as read');
    }
  };

  const openPlans = () => {
    try {
      (navigation as any).navigate('Plans');
    } catch (_) {
      Alert.alert('Tip', 'Open Deployment Plans from the home menu to see assigned projects.');
    }
  };

  const formatDate = (createdAt: string) => {
    try {
      const d = new Date(createdAt);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.card, item.read && styles.cardRead]}
      onPress={() => markRead(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
      <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      {item.type === 'project_approved' && (
        <TouchableOpacity style={styles.cta} onPress={openPlans}>
          <Text style={styles.ctaText}>Open My Projects →</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  if (loading && list.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading notifications…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔔 Notifications</Text>
        <Text style={styles.headerSubtitle}>
          Project approvals and updates
        </Text>
      </View>
      <FlatList
        data={list}
        renderItem={renderItem}
        keyExtractor={(n) => n.id}
        contentContainerStyle={list.length === 0 ? styles.emptyWrap : styles.listWrap}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8b5cf6']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySub}>When projects are approved for you, they’ll show here.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f23' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#a0a0b8' },
  header: {
    padding: 20,
    paddingTop: 56,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#a0a0b8' },
  listWrap: { padding: 16, paddingBottom: 40 },
  emptyWrap: { flex: 1, padding: 16 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  cardRead: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: '#ffffff' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8b5cf6', marginLeft: 8 },
  message: { fontSize: 14, color: '#a0a0b8', marginBottom: 8 },
  date: { fontSize: 12, color: '#6b7280' },
  cta: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start', backgroundColor: '#8b5cf6', borderRadius: 8 },
  ctaText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#a0a0b8', textAlign: 'center', paddingHorizontal: 24 },
});
