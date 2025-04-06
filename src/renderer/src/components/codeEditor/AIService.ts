import OpenAI from 'openai'

/**
 * Interface for AI completion options
 */
interface AICompletionOptions {
  prompt: string
  selection: string
  codeBefore: string
  codeAfter: string
}

/**
 * AI service that handles code completions using OpenRouter with Gemini 2.0
 */
export class AIService {
  private client: OpenAI

  constructor() {
    // Initialize OpenAI client with OpenRouter configuration
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: import.meta.env.RENDERER_VITE_OPENROUTER_API_KEY || 'missing_api_key',
      dangerouslyAllowBrowser: true
    })
  }

  /**
   * Generate code completion based on the provided options
   * @param options - The AI completion options
   * @returns A promise that resolves to the generated code
   */
  async generateCompletion(options: AICompletionOptions): Promise<string> {
    try {
      const { prompt, selection, codeBefore, codeAfter } = options
      
      // Create a prompt template
      const fullPrompt = `
Given the following code context, ${prompt}

SELECTED CODE:
${selection}

CODE BEFORE SELECTION:
${codeBefore}

CODE AFTER SELECTION:
${codeAfter}

Instructions:
1. Modify ONLY the selected code
2. Maintain consistent style with surrounding code
3. Ensure the edit is complete and can be inserted directly
4. Return ONLY the replacement code, no explanations
5. Use modern programming patterns and best practices

Your task: ${prompt}`.trim()

      // Make the API call
      const completion = await this.client.chat.completions.create({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more focused code generation
        max_tokens: 2048  // Limit the response size
      })

      // Return the generated code
      return completion.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('Error generating AI completion:', error)
      throw error
    }
  }
}

// Export a singleton instance
export const aiService = new AIService() 