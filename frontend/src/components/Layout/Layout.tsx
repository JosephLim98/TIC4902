import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import './Layout.css';

interface NavigationItem {
    label: string;
    path: string;
    icon: ReactElement;
}

const Layout: React.FC = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
    const location = useLocation();

    const navigationItems: NavigationItem[] = [
        {
            label: 'Dashboard',
            // TODO: Update API endpoint when supported
            path: '/dashboard',
            icon: (
                <span className="material-symbols-outlined">grid_view</span>
                // <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                //     <rect x="3" y="3" width="7" height="7"></rect>
                //     <rect x="14" y="3" width="7" height="7"></rect>
                //     <rect x="14" y="14" width="7" height="7"></rect>
                //     <rect x="3" y="14" width="7" height="7"></rect>
                // </svg>
            )
        },
        {
            label: 'Create Pipeline',
            // TODO: Update API endpoint when supported
            path: '/pipelines/create',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            )
        }
    ];

    const isActiveRoute = (path: string): boolean => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

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
                        className="collapse-btn"
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
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
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="user-details">
                                <div className="user-name">Admin</div>
                                <div className="user-role">System Manager</div>
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
                        <button className="icon-btn" aria-label="Notifications">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                        </button>
                        <button className="icon-btn" aria-label="Settings">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M12 1v6m0 6v6m6.364-13.364l-4.243 4.243m-4.242 4.242l-4.243 4.243M23 12h-6m-6 0H1m18.364 6.364l-4.243-4.243m-4.242-4.242l-4.243-4.243"></path>
                            </svg>
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