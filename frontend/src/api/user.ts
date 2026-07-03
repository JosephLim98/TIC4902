import client from "./client";
import type { AxiosError } from 'axios'

export interface UserProfile {
    id: number;
    username: string;
    email: string;
    created_at: string;
    updated_at: string;
    last_login_at: string | null;
}

function authHeader(): Record<string, string> {
    const token = localStorage.getItem('jwtToken') || sessionStorage.getItem('jwtToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractMessage(err: unknown, fallback: string): string {
    const axiosErr = err as AxiosError<{ message?: string }>
    return axiosErr?.response?.data?.message ?? fallback
}

// Fetch the logged in user's profile
export async function fetchProfile(): Promise<UserProfile> {
    try {
        const { data } = await client.get('/users/profile', {
            headers: authHeader(),
        });
        return data.data as UserProfile;
    } catch (err) {
        throw new Error(extractMessage(err, 'Failed to load profile'))
    }
    
}

// Update: Change username / email
export async function updateProfile(payload: {
    username?: string;
    email?: string;
}): Promise<UserProfile>{
    try {
        const { data } = await client.patch('/users/profile', payload, {
            headers: authHeader(),
        });
        return data.data as UserProfile;
    } catch (err) {
        throw new Error(extractMessage(err, 'Failed to update profile'))
    }
}

// Update: Change password
export async function changePassword(payload: {
    currentPassword: string;
    newPassword: string;
}): Promise<void> {
    try {
        await client.patch('/users/password', payload, {
            headers: authHeader(),
        });
    } catch (err) {
        throw new Error(extractMessage(err, 'Failed to change password'))
    }
}

// Delete: Permanently remove the account
export async function deleteAccount(payload: {
    password: string;
}): Promise<void> {
    try {
        await client.delete('/users/account', {
            headers: authHeader(),
            data: payload
        });
    } catch (err) {
        throw new Error(extractMessage(err, 'Failed to delete account'))
    }
}