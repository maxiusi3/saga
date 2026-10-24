/** @jest-environment node */

import { evaluateG2FidelityBenchmark } from '@/lib/eval/g2-fidelity-benchmark'

describe('G2 Fidelity Benchmark (200 planted errors / 200 clean negatives across 10 holdout families)', () => {
  it('meets all G2 quality gate thresholds (>=95% detection, <=10% false positive, 0 severe leaks, 10/10 E0 hard cases)', () => {
    const summary = evaluateG2FidelityBenchmark()

    expect(summary.holdoutFamilyCount).toBe(10)
    expect(summary.totalPlantedErrors).toBe(200)
    expect(summary.totalCleanNegatives).toBe(200)
    expect(summary.plantedErrorDetectionRate).toBeGreaterThanOrEqual(0.95)
    expect(summary.falsePositiveRate).toBeLessThanOrEqual(0.10)
    expect(summary.unresolvedSevereInApprovedCount).toBe(0)
    expect(summary.audioSeekSpotCheckPassed).toBe(100)
    expect(summary.audioSeekSpotCheckTotal).toBe(100)
    expect(summary.e0HardCasesPassed).toBe(10)
    expect(summary.e0HardCasesTotal).toBe(10)
    expect(summary.ablationWithoutVerification.severeFabricationsLeakedIntoApproved).toBeGreaterThan(100)
    expect(summary.g2GatePassed).toBe(true)
  })
})
