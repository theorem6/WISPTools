// Gemini AI Service for PCI Conflict Analysis
import { PUBLIC_GEMINI_API_KEY } from '$env/static/public';
import { browser } from '$app/environment';

export class GeminiService {
  private apiKey: string = PUBLIC_GEMINI_API_KEY;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

  /**
   * Analyze PCI conflicts using Gemini AI
   */
  async analyzePCIConflicts(analysisData: string): Promise<string> {
    if (!browser) {
      return this.generateBasicRecommendations(analysisData);
    }

    if (!this.apiKey || this.apiKey === 'your-gemini-api-key-here') {
      return this.generateBasicRecommendations(analysisData);
    }

    try {
      const prompt = `You are a telecommunications network engineer specializing in LTE network optimization.

Analyze the following PCI conflicts and provide:
1. Priority ranking of conflicts to resolve
2. Specific PCI reassignment recommendations
3. Network optimization strategies

Conflict Data:
${analysisData.substring(0, 2000)}

Provide concise, actionable recommendations in bullet points.`;

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
            temperature: 0.4,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn(`Gemini API error: ${response.status} ${response.statusText}`);
        return this.generateBasicRecommendations(analysisData);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      } else {
        console.warn('Unexpected Gemini API response format');
        return this.generateBasicRecommendations(analysisData);
      }

    } catch (error) {
      console.error('Gemini API error:', error);
      return this.generateBasicRecommendations(analysisData);
    }
  }

  /**
   * Generate basic recommendations without AI (fallback)
   */
  private generateBasicRecommendations(analysisData: string): string {
    const lines = analysisData.split('\n').filter(l => l.trim());
    const conflictCount = lines.length;
    const criticalCount = lines.filter(l => l.includes('CRITICAL')).length;
    const highCount = lines.filter(l => l.includes('HIGH')).length;
    const mod3Count = lines.filter(l => l.includes('MOD3')).length;
    const mod6Count = lines.filter(l => l.includes('MOD6')).length;

    return `PCI Conflict Analysis Summary:

📊 Conflict Overview:
• Total Conflicts: ${conflictCount}
• Critical Priority: ${criticalCount}
• High Priority: ${highCount}

🔍 Conflict Types:
• Mod3 (CRS) Conflicts: ${mod3Count}
• Mod6 (PBCH) Conflicts: ${mod6Count}

💡 Recommendations:

1. **Immediate Actions:**
   ${criticalCount > 0 ? `• Resolve ${criticalCount} CRITICAL conflicts within 24 hours` : '• No critical conflicts detected'}
   ${highCount > 0 ? `• Address ${highCount} HIGH priority conflicts within 1 week` : ''}

2. **PCI Reassignment Strategy:**
   • Use the automated PCI optimizer to find optimal assignments
   • Prioritize cells with multiple conflicts
   • Maintain Mod3 diversity across sectors

3. **Network Optimization:**
   • Review cell power levels for overlapping coverage
   • Consider frequency-domain separation for co-channel cells
   • Implement regular PCI audits (monthly recommended)

4. **Best Practices:**
   • Reserve separate PCI pools for 3-sector and 4-sector sites
   • Maintain minimum 3km separation for same Mod3 PCIs
   • Document all PCI changes in network management system

${this.apiKey === 'your-gemini-api-key-here' ? '\n⚠️ Note: AI analysis unavailable. Configure Gemini API key for enhanced recommendations.' : ''}`;
  }
}

export const geminiService = new GeminiService();