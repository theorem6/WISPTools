// Timezone utilities for displaying dates in tenant's configured timezone

import { get } from 'svelte/store';
import { currentTenant } from '$lib/stores/tenantStore';

// Common US timezones
export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: '-05:00' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: '-06:00' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: '-07:00' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)', offset: '-07:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: '-08:00' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: '-09:00' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: '-10:00' },
];

// Get the tenant's configured timezone
export function getTenantTimezone(): string {
  const tenant = get(currentTenant);
  return tenant?.settings?.timezone || 'America/Denver';
}

/**
 * Format a date in the tenant's timezone
 * @param date - Date string, Date object, or timestamp
 * @param options - Intl.DateTimeFormatOptions for customizing output
 * @returns Formatted date string in tenant's timezone
 */
export function formatInTenantTimezone(
  date: string | Date | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return 'Never';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    
    const timezone = getTenantTimezone();
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    };
    
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(date);
  }
}

/**
 * Format a date as relative time (e.g., "5 minutes ago")
 * Falls back to absolute time if too old
 * @param date - Date string, Date object, or timestamp
 * @returns Relative or absolute formatted date string
 */
export function formatRelativeTime(date: string | Date | number | null | undefined): string {
  if (!date) return 'Never';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    // If less than 24 hours, show relative time
    if (diffDays < 1) {
      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    
    // Otherwise show absolute time in tenant timezone
    return formatInTenantTimezone(dateObj);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return String(date);
  }
}

/**
 * Format just the time portion in tenant's timezone
 * @param date - Date string, Date object, or timestamp
 * @returns Time string like "3:45 PM"
 */
export function formatTimeOnly(date: string | Date | number | null | undefined): string {
  return formatInTenantTimezone(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format just the date portion in tenant's timezone
 * @param date - Date string, Date object, or timestamp
 * @returns Date string like "Nov 27, 2025"
 */
export function formatDateOnly(date: string | Date | number | null | undefined): string {
  return formatInTenantTimezone(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get timezone label for display
 * @param timezoneId - IANA timezone identifier
 * @returns Human-readable timezone label
 */
export function getTimezoneLabel(timezoneId: string): string {
  const tz = US_TIMEZONES.find(t => t.value === timezoneId);
  return tz?.label || timezoneId;
}

