import { createContext } from 'react';

export interface User {
    username: string;
    email: string;
    token: string;
}

export interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    error: string | null;
    clearError: () => void;
    updateUser: (fields: Partial<Pick<User, 'username' | 'email'>>) => void;
    // Epoch ms when a 429 rate limit lifts, or null if not currently rate-limited.
    // Read from the Retry-After header the backend sends on 429 responses.
    rateLimitedUntil: number | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);