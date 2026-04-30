import OpenAI from 'openai'

export interface StoryMetadata {
    era: string // e.g., "1980-1989"
    year?: number
    topics: string[]
    sentiment: string
    historicalEvents: string[]
    locations: string[]
}

export class MetadataService {
    private openai: OpenAI

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })
    }

    async extractMetadata(text: string): Promise<StoryMetadata> {
        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert historian and archivist. Analyze the following personal story transcript and extract key metadata.
            Return a JSON object with the following fields:
            - era: The decade the story primarily takes place in (e.g., "1980-1989").
            - year: The specific year if mentioned or inferable (number or null).
            - topics: Array of 3-5 key themes (e.g., "Immigration", "First Love").
            - sentiment: "Positive", "Negative", or "Neutral".
            - historicalEvents: Array of major historical events mentioned or implied (e.g., "Fall of Berlin Wall").
            - locations: Array of locations mentioned.
            
            Output strictly valid JSON.`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                model: 'gpt-4o-mini',
                response_format: { type: 'json_object' },
            })

            const content = completion.choices[0].message.content
            if (!content) throw new Error('No content in response')

            return JSON.parse(content) as StoryMetadata
        } catch (error) {
            console.error('Metadata extraction error:', error)
            throw error
        }
    }
}

export const metadataService = new MetadataService()
