'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { getProfile, updateProfile, updatePassword, getUser } from '@/actions/auth'
import { getMyNewsletterStatus, setMyNewsletterSubscription } from '@/actions/reviews'
import { uploadCustomerImage } from '@/actions/media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Camera, User, KeyRound, Mail } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/ui/surface'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [subscribed, setSubscribed] = useState(false)
  const [savingSubscription, setSavingSubscription] = useState(false)

  useEffect(() => {
    async function load() {
      const [profile, user, isSubscribed] = await Promise.all([getProfile(), getUser(), getMyNewsletterStatus()])
      setEmail(user?.email ?? '')
      setFullName(profile?.full_name ?? '')
      setPhone(profile?.phone ?? '')
      setAvatarUrl(profile?.avatar_url ?? '')
      setSubscribed(isSubscribed)
      setLoading(false)
    }
    load()
  }, [])

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingAvatar(true)
    try {
      const url = await uploadCustomerImage(file)
      const result = await updateProfile({ avatar_url: url })
      if (result && 'error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'Could not save your photo')
        return
      }
      setAvatarUrl(url)
      toast.success('Profile photo updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload that image')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const result = await updateProfile({ full_name: fullName, phone: phone || undefined })
      if (result && 'error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'Please check your details')
        return
      }
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSavingPassword(true)
    try {
      const result = await updatePassword({ password: newPassword, confirmPassword })
      if (result && 'error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'Passwords do not match')
        return
      }
      toast.success('Password updated')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  async function toggleSubscription(next: boolean) {
    setSavingSubscription(true)
    try {
      const result = await setMyNewsletterSubscription(next)
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      setSubscribed(next)
      toast.success(next ? 'Subscribed to the newsletter' : 'Unsubscribed from the newsletter')
    } catch {
      toast.error('Failed to update your preference')
    } finally {
      setSavingSubscription(false)
    }
  }

  // Settings was three <section>s separated by top borders on bare cream, so
  // the page had no enclosure at all — the fields floated and the boundary
  // between "profile" and "password" was a single hairline. Each concern is a
  // panel now, which is also what makes the destructive-adjacent one (password)
  // read as its own decision rather than a continuation of the form above it.
  if (loading) {
    return (
      <div className="max-w-xl space-y-6">
        {[0, 1, 2].map((i) => (
          <Panel key={i} className="animate-pulse p-6">
            <div className="h-3 w-24 rounded-full bg-rule/60" />
            <div className="mt-5 space-y-3">
              <div className="h-9 w-full rounded-[var(--r-input)] bg-rule/30" />
              <div className="h-9 w-full rounded-[var(--r-input)] bg-rule/30" />
            </div>
          </Panel>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="font-display text-2xl text-text">Settings</h2>
        <p className="mt-1 font-body text-sm text-mid">Your details, your password, and what we send you.</p>
      </div>

      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <User className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Profile
            </span>
          }
        />
        <div className="space-y-4 p-5 md:p-6">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-rule bg-paper-warm">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center">
                  <User className="h-6 w-6 text-light" strokeWidth={1.5} aria-hidden="true" />
                </span>
              )}
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {uploadingAvatar ? 'Uploading…' : 'Change photo'}
              </Button>
              <p className="mt-1.5 font-body text-xs text-light">JPG, PNG or WebP.</p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>
          </div>

          <div>
            <Label>Email</Label>
            {/* Disabled, and now says why — a greyed field with no explanation
                reads as broken rather than deliberate. */}
            <Input value={email} disabled className="mt-1 bg-paper-warm text-mid" />
            <p className="mt-1 font-body text-xs text-light">Sign-in address. Contact us to change it.</p>
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="mt-1"
            />
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} className="rounded-full bg-forest hover:bg-forest-mid">
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Password
            </span>
          }
        />
        <div className="space-y-4 p-5 md:p-6">
          <div>
            <Label>New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
            />
            {/* The 8-character rule was enforced in savePassword() but never
                stated, so the only way to discover it was to fail. */}
            <p className="mt-1 font-body text-xs text-light">At least 8 characters.</p>
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={savePassword} disabled={savingPassword} className="rounded-full bg-forest hover:bg-forest-mid">
            {savingPassword ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Email preferences
            </span>
          }
        />
        <label className="flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors hover:bg-paper-warm/40 md:p-6">
          <div>
            <div className="font-body text-sm text-text">Trail Notes newsletter</div>
            <div className="mt-0.5 font-body text-xs text-mid">
              New drops, restocks, and field notes — no spam.
            </div>
          </div>
          <input
            type="checkbox"
            checked={subscribed}
            onChange={(e) => toggleSubscription(e.target.checked)}
            disabled={savingSubscription}
            className="h-4 w-4 shrink-0 accent-forest"
          />
        </label>
      </Panel>
    </div>
  )
}
