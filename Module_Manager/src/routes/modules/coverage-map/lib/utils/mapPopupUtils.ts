/**
 * Popup content utility functions for map graphics
 */

export function createBackhaulPopupContent(feature: any): string {
  const attrs = feature.graphic.attributes;
  let typeIcon = '🌐';
  let typeName = 'Fiber';

  if (attrs.backhaulType === 'fixed-wireless-licensed') {
    typeIcon = '📡';
    typeName = 'Licensed Wireless';
  } else if (attrs.backhaulType === 'fixed-wireless-unlicensed') {
    typeIcon = '📻';
    typeName = 'Unlicensed Wireless';
  }

  return `
    <div class="popup-content">
      <p><strong>Type:</strong> ${typeIcon} ${typeName}</p>
      <p><strong>From:</strong> ${attrs.fromSite}</p>
      <p><strong>To:</strong> ${attrs.toSite}</p>
      <p><strong>Capacity:</strong> ${attrs.capacity} Mbps</p>
      <p><strong>Status:</strong> ${attrs.status}</p>
    </div>
  `;
}
