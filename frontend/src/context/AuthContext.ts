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
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);