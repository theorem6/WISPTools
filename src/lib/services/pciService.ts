// PCI Service - Business logic facade layer
// Isolates business operations from UI components
import { pciMapper, type Cell, type PCIConflict, type PCIConflictAnalysis } from '../pciMapper';
import { pciOptimizer, type OptimizationResult } from '../pciOptimizer';
import { geminiService } from '../geminiService';
import { 
  cellsActions, 
  conflictsActions, 
  optimizationActions, 
  analysisActions 
} from '../stores/appState';

// ============================================================================
// Service Response Types - Consistent error handling
// ============================================================================

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AnalysisResult {
  conflicts: PCIConflict[];
  analysis: PCIConflictAnalysis;
  geminiAnalysis: string;
}

// ============================================================================
// Error Handling - Centralized error management
// ============================================================================

class PCIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PCIServiceError';
  }
}

const handleError = (error: unknown, context: string): ServiceResult<never> => {
  console.error(`[PCIService] Error in ${context}:`, error);
  
  if (error instanceof PCIServiceError) {
    return { success: false, error: error.message };
  }
  
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  
  return { success: false, error: 'An unknown error occurred' };
};

// ============================================================================
// PCI Service Class - Encapsulated business operations
// ============================================================================

export class PCIService {
  // ========================================================================
  // Cell Management
  // ========================================================================
  
  /**
   * Load cells into the system
   */
  async loadCells(cells: Cell[]): Promise<ServiceResult<Cell[]>> {
    try {
      if (!cells || cells.length === 0) {
        throw new PCIServiceError('No cells provided', 'INVALID_INPUT');
      }
      
      // Validate cells
      const validationResult = this.validateCells(cells);
      if (!validationResult.success) {
        return validationResult;
      }
      
      cellsActions.set(cells);
      return { success: true, data: cells };
    } catch (error) {
      const result = handleError(error, 'loadCells');
      cellsActions.setError(result.error || 'Failed to load cells');
      return result;
    }
  }
  
  /**
   * Add cells to existing collection
   */
  async addCells(newCells: Cell[]): Promise<ServiceResult<Cell[]>> {
    try {
      if (!newCells || newCells.length === 0) {
        throw new PCIServiceError('No cells provided', 'INVALID_INPUT');
      }
      
      // Validate new cells
      const validationResult = this.validateCells(newCells);
      if (!validationResult.success) {
        return validationResult;
      }
      
      // Auto-assign PCI values if needed
      const processedCells = this.autoAssignPCIs(newCells);
      
      cellsActions.add(processedCells);
      return { success: true, data: processedCells };
    } catch (error) {
      const result = handleError(error, 'addCells');
      cellsActions.setError(result.error || 'Failed to add cells');
      return result;
    }
  }
  
  /**
   * Clear all cells
   */
  clearCells(): ServiceResult<void> {
    try {
      cellsActions.clear();
      conflictsActions.clear();
      analysisActions.clear();
      return { success: true };
    } catch (error) {
      return handleError(error, 'clearCells');
    }
  }
  
  // ========================================================================
  // Analysis Operations
  // ========================================================================
  
  /**
   * Perform comprehensive PCI conflict analysis
   */
  async performAnalysis(cells: Cell[]): Promise<ServiceResult<AnalysisResult>> {
    try {
      if (!cells || cells.length === 0) {
        throw new PCIServiceError('No cells to analyze', 'NO_DATA');
      }
      
      conflictsActions.setLoading(true);
      analysisActions.setLoading(true);
      
      // Detect conflicts
      const analysis = await pciMapper.analyzeConflicts(cells, true); // Enable LOS checking
      const conflicts = analysis.conflicts;
      
      // Update conflicts store
      conflictsActions.set(conflicts, analysis);
      
      // Get AI analysis
      const analysisData = this.formatConflictsForAI(conflicts);
      console.log(`[PCIService] Formatted ${conflicts.length} conflicts for AI analysis`);
      console.log(`[PCIService] Analysis data length: ${analysisData.length} characters`);
      
      const geminiAnalysis = await this.getAIAnalysis(analysisData);
      console.log(`[PCIService] Gemini analysis received: ${geminiAnalysis.substring(0, 100)}...`);
      
      // Update analysis store
      analysisActions.setGeminiAnalysis(geminiAnalysis);
      analysisActions.setRecommendations(analysis.recommendations);
      
      return {
        success: true,
        data: { conflicts, analysis, geminiAnalysis }
      };
    } catch (error) {
      const result = handleError(error, 'performAnalysis');
      conflictsActions.setError(result.error || 'Analysis failed');
      analysisActions.setError(result.error || 'Analysis failed');
      return result;
    } finally {
      conflictsActions.setLoading(false);
      analysisActions.setLoading(false);
    }
  }
  
  /**
   * Get AI analysis for conflicts
   */
  private async getAIAnalysis(analysisData: string): Promise<string> {
    console.log(`[PCIService] getAIAnalysis called with data: ${analysisData ? 'YES' : 'NO'}`);
    
    if (!analysisData || analysisData.trim() === '') {
      console.warn('[PCIService] No analysis data provided - returning default message');
      return "No conflicts to analyze.";
    }
    
    console.log(`[PCIService] Calling Gemini API with ${analysisData.length} chars of conflict data`);
    
    try {
      const result = await geminiService.analyzePCIConflicts(analysisData);
      console.log(`[PCIService] Gemini returned: ${result.substring(0, 150)}...`);
      return result;
    } catch (error) {
      console.error('[PCIService] AI analysis error:', error);
      return 'AI analysis unavailable. Please review the conflict list manually.';
    }
  }
  
  /**
   * Format conflicts for AI analysis
   */
  private formatConflictsForAI(conflicts: PCIConflict[]): string {
    return conflicts.map(c =>
      `Conflict: ${c.primaryCell.id} (PCI: ${c.primaryCell.pci}) vs ${c.conflictingCell.id} (PCI: ${c.conflictingCell.pci}), Type: ${c.conflictType}, Severity: ${c.severity}, Distance: ${c.distance.toFixed(2)}m`
    ).join('\n');
  }
  
  // ========================================================================
  // Optimization Operations
  // ========================================================================
  
  /**
   * Optimize PCI assignments to resolve conflicts
   */
  async optimizePCIs(cells: Cell[]): Promise<ServiceResult<OptimizationResult>> {
    try {
      if (!cells || cells.length === 0) {
        throw new PCIServiceError('No cells to optimize', 'NO_DATA');
      }
      
      optimizationActions.setOptimizing(true);
      
      // Run optimization
      const result = await pciOptimizer.optimizePCIAssignments(cells, true); // Enable LOS checking
      
      // Update stores
      optimizationActions.setResult(result);
      cellsActions.set(result.optimizedCells);
      
      // Re-run analysis with optimized cells (with LOS)
      await this.performAnalysis(result.optimizedCells);
      
      return { success: true, data: result };
    } catch (error) {
      const result = handleError(error, 'optimizePCIs');
      optimizationActions.setError(result.error || 'Optimization failed');
      return result;
    } finally {
      optimizationActions.setOptimizing(false);
    }
  }
  
  // ========================================================================
  // Validation and Utilities
  // ========================================================================
  
  /**
   * Validate cell data
   */
  private validateCells(cells: Cell[]): ServiceResult<Cell[]> {
    const errors: string[] = [];
    
    cells.forEach((cell, index) => {
      if (!cell.id) {
        errors.push(`Cell at index ${index} missing ID`);
      }
      
      if (typeof cell.latitude !== 'number' || cell.latitude < -90 || cell.latitude > 90) {
        errors.push(`Cell ${cell.id || index}: Invalid latitude`);
      }
      
      if (typeof cell.longitude !== 'number' || cell.longitude < -180 || cell.longitude > 180) {
        errors.push(`Cell ${cell.id || index}: Invalid longitude`);
      }
      
      if (cell.pci !== undefined && cell.pci !== -1 && (cell.pci < 0 || cell.pci > 503)) {
        errors.push(`Cell ${cell.id || index}: PCI must be between 0-503 or -1 for auto-assign`);
      }
    });
    
    if (errors.length > 0) {
      return {
        success: false,
        error: `Validation failed:\n${errors.join('\n')}`
      };
    }
    
    return { success: true, data: cells };
  }
  
  /**
   * Auto-assign PCI values for cells with PCI = -1
   */
  private autoAssignPCIs(cells: Cell[]): Cell[] {
    return cells.map(cell => {
      if (cell.pci === -1) {
        const suggestedPCIs = pciMapper.suggestPCI(cells.filter(c => c.pci !== -1));
        return { ...cell, pci: suggestedPCIs[0] || Math.floor(Math.random() * 504) };
      }
      return cell;
    });
  }
  
  /**
   * Suggest PCI values for manual assignment
   */
  suggestPCIs(existingCells: Cell[], count: number = 10): ServiceResult<number[]> {
    try {
      const suggestions = pciMapper.suggestPCI(existingCells).slice(0, count);
      return { success: true, data: suggestions };
    } catch (error) {
      return handleError(error, 'suggestPCIs');
    }
  }
  
  /**
   * Get conflict statistics
   */
  getConflictStats(conflicts: PCIConflict[]) {
    return {
      total: conflicts.length,
      critical: conflicts.filter(c => c.severity === 'CRITICAL').length,
      high: conflicts.filter(c => c.severity === 'HIGH').length,
      medium: conflicts.filter(c => c.severity === 'MEDIUM').length,
      low: conflicts.filter(c => c.severity === 'LOW').length,
      byType: {
        mod3: conflicts.filter(c => c.conflictType === 'MOD3').length,
        mod6: conflicts.filter(c => c.conflictType === 'MOD6').length,
        mod12: conflicts.filter(c => c.conflictType === 'MOD12').length,
        mod30: conflicts.filter(c => c.conflictType === 'MOD30').length,
        frequency: conflicts.filter(c => c.conflictType === 'FREQUENCY').length,
        adjacentChannel: conflicts.filter(c => c.conflictType === 'ADJACENT_CHANNEL').length,
      }
    };
  }
}

// ============================================================================
// Singleton Export - Single instance for consistent state
// ============================================================================

export const pciService = new PCIService();

