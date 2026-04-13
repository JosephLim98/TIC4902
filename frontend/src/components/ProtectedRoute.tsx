import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100vh',
                flexDirection: 'column',
                gap: '1rem',
            }}>
                <LoadingSpinner size="large" />
                <p style={{ color: '#666' }}>Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        console.log('User not authenticated, redirecting to login');
        // Redirect to login but save the attempted location
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}

export default ProtectedRoute;