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
import { Loader2 } from 'lucide-react'

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

  if (loading) return <p className="font-body text-sm text-mid">Loading…</p>

  return (
    <div className="space-y-12 max-w-xl">
      <div>
        <h2 className="font-display text-2xl text-text mb-6">Settings</h2>
      </div>

      <section className="space-y-4">
        <h3 className="font-body text-xs uppercase tracking-[0.15em] text-mid">Profile</h3>
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 rounded-full overflow-hidden bg-rule/40 flex-shrink-0">
            {avatarUrl && <Image src={avatarUrl} alt="" fill sizes="64px" className="object-cover" />}
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
              {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              {uploadingAvatar ? 'Uploading…' : 'Change Photo'}
            </Button>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarPick} />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input value={email} disabled className="mt-1 bg-rule/20 text-mid" />
        </div>
        <div>
          <Label>Full Name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="mt-1" />
        </div>
        <Button onClick={saveProfile} disabled={savingProfile} className="bg-forest hover:bg-forest-mid">
          {savingProfile ? 'Saving…' : 'Save Profile'}
        </Button>
      </section>

      <section className="space-y-4 pt-8 border-t border-rule">
        <h3 className="font-body text-xs uppercase tracking-[0.15em] text-mid">Change Password</h3>
        <div>
          <Label>New Password</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Confirm New Password</Label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1" />
        </div>
        <Button onClick={savePassword} disabled={savingPassword} className="bg-forest hover:bg-forest-mid">
          {savingPassword ? 'Updating…' : 'Update Password'}
        </Button>
      </section>

      <section className="space-y-3 pt-8 border-t border-rule">
        <h3 className="font-body text-xs uppercase tracking-[0.15em] text-mid">Email Preferences</h3>
        <label className="flex items-center justify-between gap-4 p-4 border border-rule rounded-sm cursor-pointer">
          <div>
            <div className="font-body text-sm text-text">Trail Notes Newsletter</div>
            <div className="font-body text-xs text-mid mt-0.5">New drops, restocks, and field notes — no spam.</div>
          </div>
          <input
            type="checkbox"
            checked={subscribed}
            onChange={(e) => toggleSubscription(e.target.checked)}
            disabled={savingSubscription}
            className="h-4 w-4 accent-forest"
          />
        </label>
      </section>
    </div>
  )
}
