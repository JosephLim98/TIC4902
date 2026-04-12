import { createContext } from 'react';
// import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import React, { createContext, useContext, useState, useEffect } from 'react';
// import type { ReactNode } from 'react';

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

// const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthContext = createContext<AuthContextType | undefined>(undefined);