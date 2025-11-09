export interface WolframQueryResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

class WolframService {
  async query(_expression: string): Promise<WolframQueryResult> {
    // Placeholder implementation – real integration can be wired later.
    return {
      success: false,
      error: 'Wolfram service not configured'
    };
  }
}

export const wolframService = new WolframService();
