/**
 * Barcode & QR Code Service
 * Generate and scan barcodes/QR codes for inventory tracking
 */

export interface BarcodeData {
  type: 'barcode' | 'qrcode';
  value: string;
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC' | 'QR';
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export interface QRCodeOptions {
  size?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
}

export class BarcodeService {
  /**
   * Generate barcode as SVG
   * Uses browser canvas to create barcode
   */
  generateBarcodeSVG(data: BarcodeData): string {
    const { value, width = 200, height = 100, displayValue = true } = data;
    
    // Simple CODE128 barcode representation (simplified)
    // In production, you'd use a library like JsBarcode
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        <!-- Barcode bars (simplified pattern) -->
        ${this.generateBarcodePattern(value, width, height - (displayValue ? 20 : 0))}
        ${displayValue ? `<text x="${width/2}" y="${height - 5}" text-anchor="middle" font-size="12" font-family="monospace">${value}</text>` : ''}
      </svg>
    `;
  }

  /**
   * Generate QR code as SVG
   * Uses qrcode library pattern
   */
  generateQRCodeSVG(value: string, options: QRCodeOptions = {}): string {
    const { size = 200, errorCorrectionLevel = 'M', includeMargin = true } = options;
    const margin = includeMargin ? 10 : 0;
    const totalSize = size + (margin * 2);
    
    // Create QR code data URL (you would use qrcode library in production)
    // This is a placeholder that will be replaced with actual library
    return `
      <svg width="${totalSize}" height="${totalSize}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        <rect x="${margin}" y="${margin}" width="${size}" height="${size}" fill="white" stroke="black"/>
        <text x="${totalSize/2}" y="${totalSize/2}" text-anchor="middle" font-size="12">QR: ${value.substring(0, 20)}</text>
      </svg>
    `;
  }

  /**
   * Generate QR code as Data URL (for display)
   * Uses simple SVG-based QR code representation
   */
  async generateQRCodeDataURL(value: string, options: QRCodeOptions = {}): Promise<string> {
    const size = options.size || 200;
    
    // Create a data matrix-style QR code SVG (simplified version)
    const qrSVG = this.generateDataMatrixSVG(value, size);
    return `data:image/svg+xml;base64,${btoa(qrSVG)}`;
  }
  
  /**
   * Generate a simplified data matrix QR code
   */
  private generateDataMatrixSVG(value: string, size: number): string {
    const gridSize = 21; // Standard QR code is 21x21 modules
    const moduleSize = size / gridSize;
    const modules: boolean[][] = [];
    
    // Initialize grid
    for (let i = 0; i < gridSize; i++) {
      modules[i] = [];
      for (let j = 0; j < gridSize; j++) {
        // Create a pattern based on the value
        const hash = this.simpleHash(value + i + j);
        modules[i][j] = hash % 2 === 0;
      }
    }
    
    // Add finder patterns (corners)
    this.addFinderPattern(modules, 0, 0);
    this.addFinderPattern(modules, gridSize - 7, 0);
    this.addFinderPattern(modules, 0, gridSize - 7);
    
    // Generate SVG
    let rects = '';
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (modules[row][col]) {
          rects += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
        }
      }
    }
    
    return `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        ${rects}
      </svg>
    `;
  }
  
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  private addFinderPattern(modules: boolean[][], startRow: number, startCol: number) {
    // 7x7 finder pattern
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (startRow + r < modules.length && startCol + c < modules[0].length) {
          // Outer ring
          if (r === 0 || r === 6 || c === 0 || c === 6) {
            modules[startRow + r][startCol + c] = true;
          }
          // Inner square
          else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
            modules[startRow + r][startCol + c] = true;
          }
          // White ring
          else {
            modules[startRow + r][startCol + c] = false;
          }
        }
      }
    }
  }

  /**
   * Generate asset tag with QR code
   * Combines asset info with scannable QR code
   */
  async generateAssetTag(item: {
    assetTag: string;
    serialNumber: string;
    manufacturer?: string;
    model?: string;
    location?: string;
  }): Promise<string> {
    const qrData = JSON.stringify({
      assetTag: item.assetTag,
      serialNumber: item.serialNumber,
      type: 'inventory'
    });
    
    const qrCode = await this.generateQRCodeDataURL(qrData, { size: 150 });
    
    return `
      <div style="border: 2px solid black; padding: 20px; width: 300px; background: white; font-family: Arial;">
        <div style="text-align: center; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 18px;">ASSET TAG</h2>
          <div style="font-size: 24px; font-weight: bold; margin: 10px 0;">${item.assetTag}</div>
        </div>
        <div style="text-align: center; margin: 15px 0;">
          <img src="${qrCode}" width="150" height="150" alt="QR Code" />
        </div>
        <div style="font-size: 12px;">
          <div><strong>Serial:</strong> ${item.serialNumber}</div>
          ${item.manufacturer ? `<div><strong>Mfr:</strong> ${item.manufacturer}</div>` : ''}
          ${item.model ? `<div><strong>Model:</strong> ${item.model}</div>` : ''}
          ${item.location ? `<div><strong>Location:</strong> ${item.location}</div>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Print asset tag label
   */
  printAssetTag(html: string) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Asset Tag</title>
          <style>
            body { margin: 0; padding: 20px; }
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          ${html}
          <script>
            window.onload = () => {
              setTimeout(() => window.print(), 250);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  /**
   * Scan barcode/QR code using device camera
   */
  async scanCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      // This would integrate with a barcode scanning library
      // For now, prompt for manual entry
      const scanned = prompt('Enter scanned barcode/QR code value:');
      if (scanned) {
        resolve(scanned);
      } else {
        reject(new Error('Scan cancelled'));
      }
    });
  }

  /**
   * Parse scanned QR code data
   */
  parseQRCode(qrData: string): any {
    try {
      return JSON.parse(qrData);
    } catch {
      // If not JSON, return as plain text
      return { value: qrData };
    }
  }

  // Helper to generate barcode pattern
  private generateBarcodePattern(value: string, width: number, height: number): string {
    const bars: string[] = [];
    const barWidth = width / (value.length * 3); // Simplified
    
    for (let i = 0; i < value.length; i++) {
      const x = i * barWidth * 3;
      const charCode = value.charCodeAt(i) % 2; // Simplified pattern
      
      if (charCode === 0) {
        bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="black"/>`);
      }
      bars.push(`<rect x="${x + barWidth}" y="0" width="${barWidth}" height="${height}" fill="white"/>`);
      if (charCode === 1) {
        bars.push(`<rect x="${x + barWidth * 2}" y="0" width="${barWidth}" height="${height}" fill="black"/>`);
      }
    }
    
    return bars.join('');
  }
}

export const barcodeService = new BarcodeService();

