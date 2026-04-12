import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from "../../hooks/useAuth";
import './Layout.css';

interface NavigationItem {
    label: string;
    path: string;
    icon: ReactElement;
}

const Layout: React.FC = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
    const location = useLocation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const navigationItems: NavigationItem[] = [
        {
            label: 'Dashboard',
            // TODO: Update API endpoint when supported
            path: '/dashboard',
            icon: (
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>grid_view</span>
            )
        },
        {
            label: 'Create Pipeline',
            // TODO: Update API endpoint when supported
            path: '/pipelines/create',
            icon: (
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
            )
        }
    ];

    const isActiveRoute = (path: string): boolean => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    }

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <path 
                                d="M4 8L16 2L28 8V24L16 30L4 24V8Z" 
                                stroke="url(#logo-gradient)" 
                                strokeWidth="2"
                                fill="none"
                            />
                            <path 
                                d="M4 8L16 14M16 14L28 8M16 14V30" 
                                stroke="url(#logo-gradient)" 
                                strokeWidth="2"
                            />
                            <defs>
                                <linearGradient id="logo-gradient" x1="4" y1="2" x2="28" y2="30">
                                <stop offset="0%" stopColor="#00d9ff" />
                                <stop offset="100%" stopColor="#0099ff" />
                                </linearGradient>
                            </defs>
                        </svg>
                        {!isSidebarCollapsed && <span className="logo-text">Flink Platform</span>}
                    </div>
                    <button
                        className="collapse-btn" // Removed the conditional 'hidden-icon' class
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <span className="material-symbols-outlined">
                            {isSidebarCollapsed ? 'menu_open' : 'menu'}
                        </span>
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navigationItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${isActiveRoute(item.path) ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {!isSidebarCollapsed && <span className="nav-label">{item.label}</span>}
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.username.charAt(0).toUpperCase()}
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="user-details">
                                <div className="user-name" style={{ paddingBottom: '5px' }}>{user?.username}</div>
                                <div className="user-role">{user?.email}</div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                <header className="top-bar">
                    <div className="breadcrumb">
                        <span className="breadcrumb-item">Flink Platform</span>
                        {location.pathname !== '/' && (
                            <>
                                <span className="breadcrumb-separator">/</span>
                                <span className="breadcrumb-item current">
                                    {location.pathname.includes('create') ? 'Create Pipeline' :
                                    location.pathname.includes('edit') ? 'Edit Pipeline' :
                                    location.pathname.match(/\/pipelines\/[^\/]+$/) ? 'Pipeline Details' :
                                    'Dashboard'}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="top-bar-actions">
                        <button className="btn-logout" onClick={handleLogout}>Logout</button>
                        <button className="icon-btn" aria-label="Settings">
                            <span className="material-symbols-outlined">sunny</span>
                        </button>
                    </div>
                </header>

                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;