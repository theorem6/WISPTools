/**
 * Work Orders / Tickets Screen
 * View and manage assigned trouble tickets and installations
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';

export default function WorkOrdersScreen() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState('');
  const navigation = useNavigation();

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadTickets();
    }
  }, [userId]);

  const loadUserId = async () => {
    const uid = await AsyncStorage.getItem('userId');
    setUserId(uid || '');
  };

  const loadTickets = async () => {
    setIsLoading(true);
    
    try {
      if (!userId) {
        console.warn('No userId available, cannot load tickets');
        setTickets([]);
        return;
      }
      
      // Get tickets assigned to this user
      const tickets = await apiService.getMyTickets(userId);
      setTickets(tickets || []);
    } catch (error: any) {
      console.error('Failed to load tickets:', error);
      // Don't show alert for empty state - just log
      if (error.response?.status !== 404) {
        Alert.alert('Error', error.message || 'Failed to load tickets');
      }
      setTickets([]); // Set empty array on error
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTickets();
  };

  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      critical: '#ef4444',
      high: '#f59e0b',
      medium: '#3b82f6',
      low: '#6b7280'
    };
    return colors[priority] || '#6b7280';
  };

  const getPriorityIcon = (priority: string): string => {
    const icons: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '⚪'
    };
    return icons[priority] || '⚪';
  };

  const handleAcceptTicket = async (ticket: any) => {
    Alert.alert(
      'Accept Ticket',
      `Accept ${ticket.ticketNumber || ticket._id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              setIsLoading(true);
              await apiService.acceptWorkOrder(ticket._id || ticket.id, userId);
              Alert.alert('Success', 'Ticket accepted');
              await loadTickets(); // Reload tickets to refresh list
            } catch (error: any) {
              console.error('Error accepting ticket:', error);
              Alert.alert(
                'Error', 
                error.response?.data?.message || error.message || 'Failed to accept ticket'
              );
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderTicket = ({ item }: any) => (
    <TouchableOpacity
      style={[
        styles.ticketCard,
        { borderLeftColor: getPriorityColor(item.priority), borderLeftWidth: 4 }
      ]}
      onPress={() => navigation.navigate('TicketDetails' as never, { ticket: item } as never)}
    >
      <View style={styles.ticketHeader}>
        <View style={styles.ticketTitle}>
          <Text style={styles.priorityIcon}>{getPriorityIcon(item.priority)}</Text>
          <View style={styles.ticketTitleText}>
            <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
            <Text style={styles.ticketType}>{item.type.replace('-', ' ')}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.ticketDescription} numberOfLines={2}>
        {item.title || item.description}
      </Text>

      {item.location && (
        <Text style={styles.ticketLocation}>
          📍 {item.location.siteName || item.location.address}
        </Text>
      )}

      <View style={styles.ticketFooter}>
        <Text style={styles.ticketTime}>
          {formatTimeAgo(item.createdAt)}
        </Text>
        
        {item.status === 'open' && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptTicket(item)}
          >
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        )}
        
        {item.status === 'assigned' && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => {
              // For installations, navigate to documentation screen
              if (item.type === 'installation') {
                navigation.navigate('InstallationDocumentation' as never, {
                  workOrder: item,
                  siteId: item.affectedSites?.[0]?.siteId,
                  siteName: item.affectedSites?.[0]?.siteName,
                  installationType: item.issueCategory || 'equipment'
                } as never);
              } else {
                // Other types go to ticket details
                navigation.navigate('TicketDetails' as never, { ticket: item } as never);
              }
            }}
          >
            <Text style={styles.startText}>
              {item.type === 'installation' ? '📸 Document' : 'Start Work'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      open: '#6b7280',
      assigned: '#3b82f6',
      'in-progress': '#f59e0b',
      resolved: '#10b981',
      closed: '#374151'
    };
    return colors[status] || '#6b7280';
  };

  const formatTimeAgo = (date: string | Date): string => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minutes ago`;
    }
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  return (
    <View style={styles.container}>
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading tickets...</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicket}
          keyExtractor={(item) => item._id || item.id || String(item.ticketNumber)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7c3aed"
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.headerTitle}>My Tickets</Text>
              <Text style={styles.headerSubtitle}>
                {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No tickets assigned</Text>
              <Text style={styles.emptySubtext}>
                You're all caught up! Check back later for new work orders.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 15,
    color: '#9ca3af',
    fontSize: 16
  },
  list: {
    padding: 15
  },
  listHeader: {
    marginBottom: 15
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af'
  },
  ticketCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#374151'
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  ticketTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  priorityIcon: {
    fontSize: 24,
    marginRight: 10
  },
  ticketTitleText: {
    flex: 1
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2
  },
  ticketType: {
    fontSize: 13,
    color: '#9ca3af',
    textTransform: 'capitalize'
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  ticketDescription: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 8,
    lineHeight: 20
  },
  ticketLocation: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 10
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ticketTime: {
    fontSize: 12,
    color: '#6b7280'
  },
  acceptButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6
  },
  acceptText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  startButton: {
    backgroundColor: '#10b981',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6
  },
  startText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 15
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40
  }
});

