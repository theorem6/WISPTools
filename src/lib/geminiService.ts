// Gemini AI Service for PCI Conflict Analysis
export class GeminiService {
  private apiKey: string = "AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg";
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";
  
  /**
   * Analyze PCI conflicts using Gemini AI
   */
  async analyzePCIConflicts(analysisData: string): Promise<string> {
    const prompt = `You are an expert LTE network engineer specializing in PCI (Physical Cell Identity) conflict resolution. 
    
Please provide detailed technical analysis and recommendations for the following LTE PCI conflict data:

${analysisData}

Please structure your response with:
1. Executive Summary (key findings)
2. Technical Analysis (conflict patterns and root causes)
3. Immediate Actions Required (critical priorities)
4. Strategic Recommendations (long-term solutions)
5. Implementation Priority Matrix

Focus on:
- PCI modulo conflicts (Mod3, Mod6, Mod12, Mod30)
- Geographic clustering patterns
- Frequency band optimization
- Automated PCI assignment strategies
- Performance impact assessments
- Return on Investment considerations

Provide specific, actionable recommendations that can be implemented in a commercial LTE network.`;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              category: "HARM_CATEGORY_HATE_SPEECH", 
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
      return `AI Analysis Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    }
  }
  
  /**
   * Generate PCI assignment suggestions using AI
   */
  async suggestPCIAssignment(cells: any[], conflicts: any[]): Promise<string[]> {
    const prompt = `As an LTE expert, suggest optimal PCI assignments to resolve these conflicts:

Cells: ${JSON.stringify(cells, null, 2)}
Conflicts: ${JSON.stringify(conflicts, null, 2)}

Provide specific suggestions considering:
- PCI modulo requirements (avoid Mod3/6/12/30 conflicts)
- Geographic separation distance
- Traditional and complex reuse patterns
- Future expansion considerations

Format response as JSON array of suggested PCI values.`;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          }
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const suggestionsText = data.candidates[0].content.parts[0].text;
        // Try to extract JSON array from response
        const jsonMatch = suggestionsText.match(/\d+/g);
        return jsonMatch ? jsonMatch.map(num => parseInt(num)) : [];
      }
      
      return [];
    } catch (error) {
      console.error('PCI suggestion error:', error);
      return [];
    }
  }
  
  /**
   * Generate network optimization strategy
   */
  async generateOptimizationStrategy(analysis: any): Promise<string> {
    const prompt = `Create a comprehensive LTE network optimization strategy based on these PCI analysis results:

${JSON.stringify(analysis, null, 2)}

Provide a detailed optimization strategy including:
1. Short-term fixes (immediate actions)
2. Medium-term improvements (1-6 months)
3. Long-term strategic changes (6+ months)
4. Cost-benefit analysis
5. Risk assessment and mitigation
6. Success metrics and KPIs

Consider both technical and business aspects.`;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          }
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      }
      
      return 'Unable to generate optimization strategy at this time.';
    } catch (error) {
      console.error('Strategy generation error:', error);
      return `Strategy generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export const geminiService = new GeminiService();
