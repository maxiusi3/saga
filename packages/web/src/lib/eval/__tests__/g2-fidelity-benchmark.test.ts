/** @jest-environment node */

import { evaluateG2FidelityBenchmark } from '@/lib/eval/g2-fidelity-benchmark'

describe('G2 synthetic excerpt-verification regression', () => {
  it('reports measured fixture counters without claiming real family, audio or model acceptance', () => {
    const summary = evaluateG2FidelityBenchmark()

    expect(summary.holdoutFamilyCount).toBe(10)
    expect(summary).toMatchObject({ evidenceKind: 'synthetic_regression', realFamilyCount: 0,
      actualAudioPlaybackMeasured: false, realModelQualityMeasured: false, syntheticRegressionPassed: true })
    expect(summary.totalPlantedErrors).toBe(200)
    expect(summary.totalCleanNegatives).toBe(200)
    expect(summary.plantedErrorDetectionRate).toBeGreaterThanOrEqual(0.95)
    expect(summary.falsePositiveRate).toBeLessThanOrEqual(0.10)
    expect(summary.unresolvedSevereInApprovedCount).toBe(0)
    expect(summary.audioSeekSpotCheckPassed).toBe(100)
    expect(summary.audioSeekSpotCheckTotal).toBe(100)
    expect(summary.e0HardCasesPassed).toBe(10)
    expect(summary.e0HardCasesTotal).toBe(10)
    expect(summary.ablationWithoutVerification).toMatchObject({ measured: false,
      detectedPlantedErrors: null, plantedErrorDetectionRate: null, severeFabricationsLeakedIntoApproved: null })
    expect(summary.g2GatePassed).toBe(false)
  })
})
