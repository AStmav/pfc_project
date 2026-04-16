import { useState } from 'react'

export default function MessageComposer({ onSubmit, onTyping, disabled }) {
  const [value, setValue] = useState('')

  function handleChange(event) {
    setValue(event.target.value)
    onTyping?.(true)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }
    onSubmit(trimmed)
    setValue('')
    onTyping?.(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const trimmed = value.trim()
      if (!trimmed) {
        return
      }
      onSubmit(trimmed)
      setValue('')
      onTyping?.(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-200/90 bg-white p-3 shadow-[0_-4px_24px_-12px_rgb(15_23_42/0.08)] md:p-4"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-slate-200/90 px-3 py-2.5 text-sm leading-relaxed text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-50"
          rows={2}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Send
        </button>
      </div>
      <p className="mt-2 hidden text-[11px] text-gray-400 sm:block">
        <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans text-[10px] text-gray-600">
          Enter
        </kbd>{' '}
        to send ·{' '}
        <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans text-[10px] text-gray-600">
          Shift+Enter
        </kbd>{' '}
        new line
      </p>
    </form>
  )
}
