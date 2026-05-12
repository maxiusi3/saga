"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

type DatePickerProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onSelect"> & {
  selected?: Date | null
  onSelect?: (date: Date | null) => void
  placeholderText?: string
}

function toInputValue(date?: Date | null) {
  if (!date) return ""
  return date.toISOString().slice(0, 10)
}

export function DatePicker({
  selected,
  onSelect,
  placeholderText,
  ...props
}: DatePickerProps) {
  return (
    <Input
      type="date"
      value={toInputValue(selected)}
      placeholder={placeholderText}
      onChange={(event) => {
        onSelect?.(event.target.value ? new Date(event.target.value) : null)
      }}
      {...props}
    />
  )
}
