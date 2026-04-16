import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import AuthCard from '../components/auth/AuthCard'
import { useAuth } from '../state/useAuth'

const registerSchema = z
  .object({
    name: z
      .string()
      .max(60, 'Name is too long.')
      .optional()
      .or(z.literal('')),
    email: z
      .string()
      .email('Enter a valid email address.'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[A-Z]/, 'Add at least one uppercase letter.')
      .regex(/[0-9]/, 'Add at least one number.'),
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

function passwordStrength(password) {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 2) {
    return { label: 'Weak', width: '33%', color: 'bg-red-500' }
  }
  if (score === 3 || score === 4) {
    return { label: 'Medium', width: '66%', color: 'bg-amber-500' }
  }
  return { label: 'Strong', width: '100%', color: 'bg-emerald-500' }
}

function buildUsername({ name, email }) {
  const source = String(name || email.split('@')[0] || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (source) {
    return source.slice(0, 30)
  }
  return `user_${Date.now()}`
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const {
    register: registerField,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })
  const watchedPassword = watch('password', '')
  const watchedName = watch('name', '')
  const watchedEmail = watch('email', '')
  const strength = useMemo(() => passwordStrength(watchedPassword), [watchedPassword])
  const avatarInitials = useMemo(() => {
    const base = (watchedName || watchedEmail || '?').trim()
    return base ? base.slice(0, 2).toUpperCase() : '?'
  }, [watchedName, watchedEmail])

  async function onSubmit(values) {
    setError('')
    setLoading(true)

    try {
      const username = buildUsername({
        name: values.name,
        email: values.email,
      })
      await register({
        username,
        email: values.email,
        password: values.password,
      })
      navigate('/login', { replace: true })
    } catch (requestError) {
      const payload = requestError.response?.data
      if (typeof payload === 'string') {
        setError(payload)
      } else if (payload && typeof payload === 'object') {
        const firstError = Object.values(payload).flat()?.[0]
        setError(firstError ?? 'Unable to register user.')
      } else {
        setError('Unable to register user.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Create your workspace identity and start chatting in real time."
      footer={
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:text-brand-hover">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-slate-50 px-3 py-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-muted font-semibold text-brand">
            {avatarInitials}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Profile preview</p>
            <p className="text-xs text-gray-500">Your avatar uses initials for now.</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Name (optional)</span>
          <input
            type="text"
            {...registerField('name')}
            className="w-full rounded-2xl border border-slate-200/90 px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Jane Doe"
          />
          {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            {...registerField('email')}
            autoComplete="email"
            className="w-full rounded-2xl border border-slate-200/90 px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="you@company.com"
          />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 px-3 py-2.5 shadow-sm transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <input
              type={showPassword ? 'text' : 'password'}
              {...registerField('password')}
              autoComplete="new-password"
              className="w-full border-none p-0 text-sm text-gray-900 outline-none"
              placeholder="At least 8 chars, A-Z and number"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="rounded-md p-1 text-gray-500 transition hover:bg-slate-100 hover:text-gray-800"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all ${strength.color}`}
                style={{ width: strength.width }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Password strength: {strength.label}</p>
          </div>
          {errors.password ? (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Confirm password</span>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 px-3 py-2.5 shadow-sm transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              {...registerField('confirmPassword')}
              autoComplete="new-password"
              className="w-full border-none p-0 text-sm text-gray-900 outline-none"
              placeholder="Repeat your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="rounded-md p-1 text-gray-500 transition hover:bg-slate-100 hover:text-gray-800"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword ? (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          ) : null}
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </AuthCard>
  )
}
