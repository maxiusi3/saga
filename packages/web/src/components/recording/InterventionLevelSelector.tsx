import type { InterventionLevel } from '@saga/shared/types/agents'

interface InterventionLevelSelectorProps {
  value: InterventionLevel
  onChange: (level: InterventionLevel) => void
}

const OPTIONS: Array<{
  value: InterventionLevel
  label: string
  companionTitle: string
  description: string
}> = [
  {
    value: 'off',
    label: 'Off',
    companionTitle: 'Quiet Listener',
    description: 'Record freely at your own pace without any prompts. Great when a family member is sitting with you.',
  },
  {
    value: 'low',
    label: 'Low',
    companionTitle: 'Gentle Companion (Recommended)',
    description: 'Listens quietly and only offers a reassuring nudge if you pause for a long time or feel stuck.',
  },
  {
    value: 'high',
    label: 'High',
    companionTitle: 'Warm Host',
    description: 'Guides the conversation step by step with gentle warmup and follow-up questions.',
  },
]

export function InterventionLevelSelector({ value, onChange }: InterventionLevelSelectorProps) {
  return (
    <fieldset className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900/70">
      <legend className="px-1 text-sm font-medium text-stone-700 dark:text-stone-200">
        Choose your comfort &amp; guidance style
      </legend>
      <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-xl border p-3 transition-colors ${
              value === option.value
                ? 'border-amber-500 bg-amber-50 text-stone-900 dark:bg-amber-950/30 dark:text-stone-50'
                : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-950/60 dark:text-stone-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="intervention-level"
                aria-label={option.label}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="h-4 w-4 accent-amber-600"
              />
              <span className="font-medium">{option.companionTitle}</span>
            </span>
            <span className="mt-2 block text-xs leading-5 text-stone-500 dark:text-stone-400">
              {option.description}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
