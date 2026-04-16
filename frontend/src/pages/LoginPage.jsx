import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import AuthCard from '../components/auth/AuthCard'
import { useAuth } from '../state/useAuth'

const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Enter your username or email.'),
  password: z
    .string()
    .min(1, 'Password is required.'),
  remember: z.boolean().optional(),
})

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
      remember: false,
    },
  })

  async function onSubmit(values) {
    setError('')
    setLoading(true)

    try {
      await login({
        // Backend token endpoint currently authenticates by username.
        username: values.identifier,
        password: values.password,
      })
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ?? 'Unable to sign in. Check credentials.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to open your conversations."
      footer={
        <p className="text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-brand hover:text-brand-hover">
            Sign up
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Username or email</span>
          <input
            type="text"
            {...register('identifier')}
            autoComplete="username"
            className="w-full rounded-2xl border border-slate-200/90 px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="john@company.com"
          />
          {errors.identifier ? (
            <p className="mt-1 text-xs text-red-600">{errors.identifier.message}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 px-3 py-2.5 shadow-sm transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              autoComplete="current-password"
              className="w-full border-none p-0 text-sm text-gray-900 outline-none"
              placeholder="Enter your password"
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
          {errors.password ? (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          ) : null}
        </label>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              {...register('remember')}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Remember me
          </label>
          <button
            type="button"
            className="text-sm font-medium text-brand transition hover:text-brand-hover"
          >
            Forgot password?
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthCard>
  )
}
