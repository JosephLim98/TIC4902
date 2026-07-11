import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import type { User, AuthContextType } from './AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// express-rate-limit sends Retry-After as a number of seconds (not a date)
// When a 429 is returned, returns an epoch-ms timestamp for when the rate limit lifts, or null if the header is absent/unparseable
function parseRetryAfterMs(response: Response): number | null {
    const header = response.headers.get('Retry-After');
    if (!header) {
        return null;
    };
    
    const seconds = Number(header);
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return null;
    };

    return Date.now() + seconds * 1000;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const saved = localStorage.getItem('user') || sessionStorage.getItem('user');
        const token = localStorage.getItem('jwtToken') || sessionStorage.getItem('jwtToken');

        if (saved && token) {
            try {
                const parsed = JSON.parse(saved);
                return { ...parsed, token};
            } catch {
                return null;
            }
        }

        return null;
    });

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

    // Initialize auth state from localStorage on mount
    useEffect(() => {
        const initializeAuth = () => {
            try {
                const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
                const storedToken = localStorage.getItem('jwtToken') || sessionStorage.getItem('jwtToken');

                if (storedUser && storedToken) {
                    const parsedUser = JSON.parse(storedUser);

                    // Check if token is expired
                    if (isTokenValid(storedToken)) {
                        setUser({ ...parsedUser, token: storedToken });
                    } else {
                        setError("Your session has expired. Please log in again.");
                        logout();
                    }
                }
            } catch (err) {
                console.error('Failed to initialize auth state:', err);
                localStorage.removeItem('user');
                localStorage.removeItem('jwtToken');
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // Check if JWT token is valid (not expired)
    const isTokenValid = (token: string): boolean => {
        try {
            if (!token || token.split('.').length !== 3) {
                return false;
            }
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expirationTime = payload.exp * 1000; // Convert to milliseconds
            return Date.now() < expirationTime;
        } catch {
            return false;
        }
    };

    const login = async (email: string, password: string, rememberMe: boolean = false) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    setRateLimitedUntil(parseRetryAfterMs(response));
                }

                throw new Error(data.message || 'Login failed');
            }

            setRateLimitedUntil(null);

            const userData: User = {
                username: data.data.username,
                email: email,
                token: data.data.token,
            };

            setUser(userData);

            // Store in localStorage if remember me is checked
            if (rememberMe) {
                localStorage.setItem('user', JSON.stringify({ username: userData.username, email: userData.email }));
                localStorage.setItem('jwtToken', userData.token);
            } else {
                // Store in sessionStorage for temporary session
                sessionStorage.setItem('user', JSON.stringify({ username: userData.username, email: userData.email }));
                sessionStorage.setItem('jwtToken', userData.token);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred during login';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (username: string, email: string, password: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    setRateLimitedUntil(parseRetryAfterMs(response));
                }

                throw new Error(data.message || 'Registration failed');
            }

            setRateLimitedUntil(null);

            // Automatically log in the user after successful registration
            // await login(email, password);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred during registration';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('jwtToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('jwtToken');
        setUser(null);
    };

    const clearError = () => {
        setError(null);
    };

    const updateUser = (fields: Partial<Pick<User, 'username' | 'email'>>) => {
        setUser(prev => {
            if (!prev) return prev
            const updated = { ...prev, ...fields }
            const storage = localStorage.getItem('user') ? localStorage : sessionStorage
            storage.setItem('user', JSON.stringify({ username: updated.username, email: updated.email }))
            return updated
        })
    }

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        error,
        clearError,
        updateUser,
        rateLimitedUntil,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}