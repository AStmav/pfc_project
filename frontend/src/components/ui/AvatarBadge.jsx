function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export default function AvatarBadge({
  name,
  size = 'md',
  online = false,
  className = '',
}) {
  const dimensions = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  }[size]

  return (
    <div className={`relative inline-flex ${className}`}>
      <div
        className={`inline-flex ${dimensions} items-center justify-center rounded-full bg-brand-muted font-semibold text-brand`}
        title={name}
      >
        {getInitials(name)}
      </div>
      {online ? (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm ring-1 ring-white/80" />
      ) : null}
    </div>
  )
}
