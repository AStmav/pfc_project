import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload } from 'lucide-react'
import { updateCurrentUserAvatar } from '../api/auth'
import AvatarBadge from '../components/ui/AvatarBadge'
import { useAuth } from '../state/useAuth'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function ProfilePage() {
  const { currentUser, refreshCurrentUser } = useAuth()
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const avatarSrc = useMemo(() => {
    if (previewUrl) {
      return previewUrl
    }
    return currentUser?.avatar ?? ''
  }, [previewUrl, currentUser?.avatar])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    setError('')
    setSuccess('')

    if (!file) {
      setSelectedFile(null)
      setPreviewUrl('')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(null)
      setPreviewUrl('')
      setError('File is too large. Maximum size is 5MB.')
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setSelectedFile(null)
      setPreviewUrl('')
      setError('Use JPEG, PNG, or WEBP image format.')
      return
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleUpload(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!selectedFile) {
      setError('Select an image first.')
      return
    }

    setIsUploading(true)
    try {
      await updateCurrentUserAvatar(selectedFile)
      await refreshCurrentUser()
      setSuccess('Avatar updated successfully.')
      setSelectedFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl('')
    } catch (requestError) {
      const payload = requestError.response?.data
      const avatarError = Array.isArray(payload?.avatar)
        ? payload.avatar[0]
        : payload?.avatar
      if (!requestError.response) {
        setError('Network/CORS error. Check backend CORS and API URL.')
      } else {
        setError(avatarError || payload?.detail || 'Failed to upload avatar.')
      }
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-surface-app px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-gray-600 transition hover:bg-slate-100 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chats
        </Link>

        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[var(--shadow-elevated)]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Personal account
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Keep your profile simple and recognizable.
              </p>
            </div>
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">{currentUser?.username || 'User'}</p>
              <p>{currentUser?.email || 'No email'}</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Profile avatar"
                  className="h-24 w-24 rounded-full border border-slate-200 object-cover shadow-sm"
                />
              ) : (
                <AvatarBadge name={currentUser?.username || 'User'} size="lg" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">Profile picture</p>
                <p className="mt-1 text-xs text-gray-500">
                  Recommended: square image, at least 512x512 px.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="mt-5 space-y-3">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                Upload new avatar
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand hover:file:bg-indigo-100"
              />

              <p className="text-xs text-gray-500">Allowed: JPEG, PNG, WEBP. Max size: 5MB.</p>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Save avatar'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
