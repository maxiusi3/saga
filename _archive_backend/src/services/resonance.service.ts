import { StoryMetadata } from './metadata.service'

export interface ResonanceMatch {
    storyId: string
    similarityScore: number
    commonTopics: string[]
    commonEvents: string[]
}

export class ResonanceService {
    // In a real implementation, this would query a Vector DB or SQL with array overlap
    // For MVP, we'll mock the logic or assume a simple SQL query structure

    async findResonantStories(metadata: StoryMetadata, currentStoryId: string): Promise<ResonanceMatch[]> {
        // Mock implementation for MVP
        // In reality: SELECT * FROM stories WHERE topics && $1 OR historical_events && $2

        console.log(`Finding resonance for story in era ${metadata.era} with topics: ${metadata.topics.join(', ')}`)

        // Return dummy data for frontend verification
        return [
            {
                storyId: 'mock-1',
                similarityScore: 0.85,
                commonTopics: [metadata.topics[0] || 'Life'],
                commonEvents: [metadata.historicalEvents[0] || 'General History']
            },
            {
                storyId: 'mock-2',
                similarityScore: 0.75,
                commonTopics: [metadata.topics[1] || 'Family'],
                commonEvents: []
            }
        ]
    }

    async getResonanceStats(metadata: StoryMetadata): Promise<{ count: number, eraCount: number }> {
        // Mock stats
        return {
            count: Math.floor(Math.random() * 1000) + 50,
            eraCount: Math.floor(Math.random() * 500) + 20
        }
    }
}

export const resonanceService = new ResonanceService()
