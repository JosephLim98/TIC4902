import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import type { User, AuthContextType } from './AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                        // Token expired, clear storage
                        localStorage.removeItem('user');
                        localStorage.removeItem('jwtToken');
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
                throw new Error(data.message || 'Login failed');
            }

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
            const response = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

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
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('jwtToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('jwtToken');
    };

    const clearError = () => {
        setError(null);
    };

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        error,
        clearError,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}