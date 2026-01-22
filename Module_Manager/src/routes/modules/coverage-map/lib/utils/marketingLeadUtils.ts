/**
 * Marketing lead utility functions
 */
import type { PlanMarketingAddress } from '$lib/services/planService';

export function toNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeStreetKey(addressLine1?: string | null): string | null {
  if (!addressLine1) return null;

  const trimmed = addressLine1.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+[a-z0-9-]*)\s+(.*)$/i);
  if (!match) return null;

  const directionMap: Record<string, string> = {
    northeast: 'ne',
    northwest: 'nw',
    southeast: 'se',
    southwest: 'sw',
    north: 'n',
    south: 's',
    east: 'e',
    west: 'w'
  };

  const streetTypeMap: Record<string, string> = {
    street: 'st',
    avenue: 'ave',
    boulevard: 'blvd',
    court: 'ct',
    drive: 'dr',
    lane: 'ln',
    place: 'pl',
    road: 'rd',
    terrace: 'ter',
    trail: 'trl',
    highway: 'hwy',
    parkway: 'pkwy',
    circle: 'cir'
  };

  const numberPart = match[1].toLowerCase();
  let streetPart = match[2]
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  Object.entries(directionMap).forEach(([full, abbr]) => {
    streetPart = streetPart.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  });

  Object.entries(streetTypeMap).forEach(([full, abbr]) => {
    streetPart = streetPart.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  });

  if (!streetPart) return null;
  return `${numberPart}|${streetPart}`;
}

export function getLeadSourcePriority(lead: PlanMarketingAddress): number {
  const source = (lead.source ?? '').toLowerCase();
  if (source.includes('arcgis')) return 3;
  if (source.includes('osm')) return 2;
  if (source.includes('nominatim')) return 1;
  return 0;
}

export function buildCoordinateKey(lead: PlanMarketingAddress): string | null {
  const latitude = toNumeric(lead.latitude);
  const longitude = toNumeric(lead.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }
  const address = (lead.addressLine1 ?? '').toLowerCase();
  return `${latitude.toFixed(5)}|${longitude.toFixed(5)}|${address}`;
}

export function buildMarketingPopupContent(lead: PlanMarketingAddress, latitude: number, longitude: number): string {
  const rows: string[] = [];

  if (lead.addressLine1) {
    rows.push(`<strong>Address:</strong> ${lead.addressLine1}`);
  }
  if (lead.addressLine2) {
    rows.push(`<strong>Unit:</strong> ${lead.addressLine2}`);
  }
  const localityParts = [lead.city, lead.state, lead.postalCode].filter(Boolean).join(', ');
  if (localityParts) {
    rows.push(`<strong>Location:</strong> ${localityParts}`);
  }
  if (lead.country) {
    rows.push(`<strong>Country:</strong> ${lead.country}`);
  }
  rows.push(`<strong>Coordinates:</strong> ${latitude.toFixed(7)}, ${longitude.toFixed(7)}`);
  if (lead.source) {
    rows.push(`<strong>Source:</strong> ${lead.source}`);
  }

  return `<div class="marketing-lead-popup">${rows.join('<br/>')}</div>`;
}
