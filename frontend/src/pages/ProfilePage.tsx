import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { MaterialIcon } from '@/components/MaterialIcon'
import { Spinner } from '@/components/Spinner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { fetchProfile, updateProfile, changePassword, deleteAccount, type UserProfile } from '@/api/user'

function Field({
    label, 
    children
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                {label}
            </label>
            {children}
        </div>
    )
}

// Section Card
function Section({
    title, icon, children
}: {
    title: string
    icon: string
    children: React.ReactNode
}) {
    return (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-zinc/200 px-6 py-4">
                <MaterialIcon name={icon} size={18} className="text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    )
}

function Alert({
    type, message
}: {
    type: 'success' | 'error'
    message: string
}) {
    const colors = 
        type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
    return (
        <div className={`rounded-lg border px-3 py-2 text-sm ${colors}`}>{message}</div>
    )
}

export default function ProfilePage() {
    const { logout, updateUser } = useAuth();
    const navigate = useNavigate();

    // State: Profile Data
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [profileError, setProfileError] = useState<string | null>(null)

    // State: Edit Info Form
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [editLoading, setEditLoading] = useState(false)
    const [editStatus, setEditStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    // State: Change Password Form
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    // State: Delete Account
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const profile = await fetchProfile()
                setProfile(profile)
                setUsername(profile.username)
                setEmail(profile.email)
            } catch {
                setProfileError('Failed to load profile')
            } finally {
                setLoadingProfile(false)
            }
        }
        load()
    }, [])

    async function handleUpdateProfile(e: React.FormEvent) {
        e.preventDefault()
        setEditLoading(true)
        setEditStatus(null)

        try {
            const updated = await updateProfile({ username, email })
            setProfile(updated)
            updateUser({ username: updated.username, email: updated.email })
            setUsername(updated.username)
            setEmail(updated.email)
            setEditStatus({ type: 'success', msg: 'Profile updated successfully' })
        } catch (err: unknown) {
            setEditStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to update profile' })
        } finally {
            setEditLoading(false)
        }
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        setPasswordStatus(null)

        if (newPassword !== confirmPassword) {
            setPasswordStatus({ type: 'error', msg: 'New passwords do not match' })
            return
        }

        if (newPassword.length < 6) {
            setPasswordStatus({ type: 'error', msg: 'Password must be at least 6 characters' })
            return
        }

        setPasswordLoading(true)

        try {
            await changePassword({ currentPassword, newPassword })
            setPasswordStatus({ type: 'success', msg: 'Password changed successfully' })
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err: unknown) {
            setPasswordStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to change password' })
        } finally {
            setPasswordLoading(false)
        }
    }

    async function handleDeleteAccount(e: React.FormEvent) {
        e.preventDefault()
        setDeleteLoading(true)
        setDeleteStatus(null)

        try {
            await deleteAccount({ password: deletePassword })
            logout()
            navigate('/login')
        } catch (err: unknown) {
            setDeleteStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to delete account' })
        } finally {
            setDeleteLoading(false)
        }
    }

    if (loadingProfile) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
                <div className="animate-spin h-5 w-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
                <p className="text-sm font-medium">Loading profile...</p>
            </div>
        )
    }

    if (profileError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 rounded-2xl bg-red-50/50">
                <MaterialIcon name="error" className="text-red-300 text-5xl mb-3" />
                <h3 className="text-base font-semibold text-red-900">{profileError}</h3>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 flex-1 w-full max-w-2xl mx-auto">

            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white">
                    {profile?.username.charAt(0).toUpperCase()}
                </div>

                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{profile?.username}</h1>
                    <p className="mt-0.5 text-sm text-zinc-400">{profile?.email}</p>
                </div>
            </div>

            {/* Read-only info */}
            <Section title="Account Information" icon="info">
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Last Login">
                        <Input value={profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString() : '' } disabled />
                    </Field>

                    {/* <Field label="Member Since">
                        <Input value={profile?.created_at ? new Date(profile.created_at).toLocaleString() : '' } disabled />
                    </Field> */}

                    <Field label="Updated At">
                        <Input value={profile?.updated_at ? new Date(profile.updated_at).toLocaleString() : '' } disabled />
                    </Field>
                </div>
            </Section>

            {/* Edit Profile */}
            <Section title="Edit Profile" icon="edit">
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Username">
                            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter new username" />
                        </Field>

                        <Field label="Email">
                            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter new email" />
                        </Field>
                    </div>
                    {editStatus && <Alert type={editStatus.type} message={editStatus.msg} />}
                    <div className="flex justify-end">
                        <Button type="submit" disabled={editLoading} size="sm">
                            {/* {editLoading && <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />} */}
                            {editLoading && <Spinner light />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </Section>

            {/* Change password */}
            <Section title="Change Password" icon="lock">
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <Field label="Current Password">
                        <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="New Password">
                            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" />
                        </Field>
                        <Field label="Confirm New Password">
                            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
                        </Field>
                    </div>
                    {passwordStatus && <Alert type={passwordStatus.type} message={passwordStatus.msg} />}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={passwordLoading} size="sm">
                            {/* {passwordLoading && <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />} */}
                            {passwordLoading && <Spinner light />}
                            Update Password
                        </Button>
                    </div>
                </form>
            </Section>

            {/* Delete Account */}
            <Section title="Danger Zone" icon="warning">
                {!showDeleteConfirm ? (
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-zinc-900">Delete Account</p>
                            <p className="mt-0.5 text-xs text-zinc-500">Permanently remove your account and all associated data. This cannot be undone.</p>
                        </div>

                        <Button variant="outline" size="sm" className="ml-4 shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setShowDeleteConfirm(true)}>
                            Delete Account
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleDeleteAccount} className="space-y-4">
                        <p className="text-sm text-zinc-600">
                            Enter your password to confirm deletion.
                            <span className="text-red-600 font-medium">This is irreversible</span>
                        </p>

                        <Field label="Confirm Password">
                            <Input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter your password"/>
                        </Field>

                        {deleteStatus && <Alert type={deleteStatus.type} message={deleteStatus.msg} />}

                        <div className="flex gap-3 justify-end">
                            <Button type="button" variant="outline" size="sm" 
                                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteStatus(null) }}>
                                Cancel
                            </Button>

                            <Button type="submit" size="sm" disabled={deleteLoading || !deletePassword} className="bg-red-600 hover:bg-red-500 text-white">
                                {deleteLoading && 
                                    <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />
                                }
                                {/* {deleteLoading && <Spinner />} */}
                                Permanently Delete
                            </Button>
                        </div>
                    </form>
                )}
            </Section>
        </div>
    )
}