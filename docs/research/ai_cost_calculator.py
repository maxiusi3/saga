#!/usr/bin/env python3
"""Offline SOTA-first planning calculator; no provider calls or measured usage.

Public rates checked 2026-10-08. USD before tax, excluding plan minimums.
Workload: 120 recorded minutes, 20 photos, eight short stories, 20 searches.
The high tier is the initial quality reference, not a measured quality winner.
"""

import argparse
import json
from decimal import Decimal as D


def text_cost(model, input_tokens, output_tokens, args):
    rates = {
        "gpt-6-luna": (D("0.10"), D("0.50")),
        "claude-sonnet-5-5": (D("2"), D("10")),
        "gpt-6.1-sol": (D("2"), D("10")),
        "claude-opus-5-5": (D("4"), D("20")),
        "gpt-6-astra": (D("10"), D("50")),
    }
    pin, pout = rates[model]
    return (D(input_tokens) * args.input_multiplier * pin
            + D(output_tokens) * args.output_multiplier * pout) / D(1_000_000)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--families", type=int, default=1000)
    parser.add_argument("--input-multiplier", type=D, default=D("1"))
    parser.add_argument("--output-multiplier", type=D, default=D("1"))
    parser.add_argument("--reserve", type=D, default=D("0.20"))
    parser.add_argument("--asr-per-hour", type=D, default=D("0.22"))
    parser.add_argument("--monthly-infra", type=D, default=D("300"))
    parser.add_argument("--human-minutes", type=D, default=D("20"))
    parser.add_argument("--human-hourly", type=D, default=D("30"))
    args = parser.parse_args()
    if args.families <= 0 or min(args.input_multiplier, args.output_multiplier,
                                 args.reserve, args.asr_per_hour, args.monthly_infra,
                                 args.human_minutes, args.human_hourly) < 0:
        parser.error("Families must be positive and all budget inputs non-negative.")

    shared = {
        "scribe_v2_2_audio_hours": D("2") * args.asr_per_hour,
        "voyage_4_large_30k_tokens": D("30000") * D("0.12") / D(1_000_000),
        # Query tokens are billed once PER candidate document.
        "rerank_3_20_queries_10_docs_50_query_300_doc_tokens":
            D("20") * D("10") * (D("50") + D("300")) * D("0.05") / D(1_000_000),
    }
    costs = {
        "low": {
            **shared,
            "extraction_organization_photos_luna_90k_in_12k_out":
                text_cost("gpt-6-luna", 90000, 12000, args),
            "editing_sonnet_50k_in_12k_out":
                text_cost("claude-sonnet-5-5", 50000, 12000, args),
            "verification_luna_50k_in_4k_out":
                text_cost("gpt-6-luna", 50000, 4000, args),
        },
        "medium": {
            **shared,
            "extraction_organization_photos_sonnet_90k_in_12k_out":
                text_cost("claude-sonnet-5-5", 90000, 12000, args),
            "editing_sonnet_50k_in_12k_out":
                text_cost("claude-sonnet-5-5", 50000, 12000, args),
            "verification_opus_50k_in_4k_out":
                text_cost("claude-opus-5-5", 50000, 4000, args),
        },
        "high": {
            **shared,
            "extraction_organization_photos_opus_90k_in_12k_out":
                text_cost("claude-opus-5-5", 90000, 12000, args),
            "editing_opus_50k_in_12k_out":
                text_cost("claude-opus-5-5", 50000, 12000, args),
            "verification_astra_50k_in_4k_out":
                text_cost("gpt-6-astra", 50000, 4000, args),
        },
    }
    tiers = {}
    for tier, lines in costs.items():
        subtotal = sum(lines.values())
        budget = subtotal * (D("1") + args.reserve)
        tiers[tier] = {
            "line_items_usd": lines,
            "api_subtotal_usd": subtotal,
            "api_budget_with_reserve_usd": budget,
            "monthly_api_budget_usd": budget * args.families,
            "illustrative_cost_with_infra_and_human_usd":
                budget + args.monthly_infra / args.families
                + args.human_minutes / D("60") * args.human_hourly,
        }

    voice = {
        "assumptions": {
            "connected_minutes": 60, "user_audio_minutes": 40,
            "assistant_audio_minutes": 8, "silent_minutes": 12,
            "cumulative_text_input_tokens": 20000,
            "cumulative_text_output_tokens": 2000,
            "tts_characters_per_output_minute_assumed": 900,
        },
        "gpt_live_1_astra_backend_quality_reference":
            D("60") * D("0.05")
            + (D("20000") * 10 + D("2000") * 50) / D(1_000_000),
        "gpt_live_1_sol_backend_cost_candidate":
            D("60") * D("0.05")
            + (D("20000") * 2 + D("2000") * 10) / D(1_000_000),
        "realtime_full_fresh_audio_plus_assumed_text_only":
            (D("40") * 600 * 32 + D("8") * 1200 * 64
             + D("20000") * 4 + D("2000") * 24) / D(1_000_000),
        "realtime_mini_fresh_audio_plus_assumed_text_only":
            (D("40") * 600 * 10 + D("8") * 1200 * 20
             + D("20000") * D("0.6") + D("2000") * D("2.4")) / D(1_000_000),
        "exclusions": "Historical audio input/cache, extra text/reasoning, tools, "
                      "optional transcription, network/telephony, recording and "
                      "final offline processing; no retry reserve. These are "
                      "different architectures, not quality-equivalent quotations.",
    }
    result = {
        "as_of": "2026-10-08",
        "currency": "USD",
        "initial_quality_reference": "high",
        "pricing_boundary": "Public usage rates; paid-plan minimums, region/ZRM "
                            "premiums, storage, Precision-3, second ASR, Fable, "
                            "video and TTS are excluded. No promotional/free credits.",
        "assumptions": vars(args),
        "fixed_workload": "120 recorded minutes, 20 photos, eight short stories, "
                          "20 retrieval queries; photo tokens are assumptions, "
                          "not per-image tariffs. Text multipliers affect all "
                          "text/vision calls but not audio, embedding or reranking. "
                          "Output budgets include billed reasoning, not only prose.",
        "tiers": tiers,
        "voice_optional_incremental_60_minute_scenarios": voice,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2,
                     default=lambda value: float(value) if isinstance(value, D) else str(value)))


if __name__ == "__main__":
    main()
