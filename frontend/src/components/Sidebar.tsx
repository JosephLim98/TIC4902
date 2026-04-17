import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import flinkLogo from '@/assets/flink.png'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { MaterialIcon } from './MaterialIcon'

const navItems = [
  { to: '/', label: 'Pipelines' },
  { to: '/profile', label: 'Profile' },
]

export default function Sidebar() {
  
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const goToProfile = () => {
    navigate('/profile')
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <img src={flinkLogo} alt="Flink" className="sidebar-logo" />
        <span className="text-sm font-semibold tracking-tight text-white">Flink Data Platform</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2 pt-3">
        <p className="nav-section-label">
          Manage
        </p>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Profile */}
      {user && (
        <div className="mt-auto border-t border-white/10 space-y-1.5">
          {/* Profile Button */}
          <button onClick={goToProfile} className="flex w-full items-center gap-3 p-3 transition-colors hover:bg-white/[0.06]">
            {/* Avatar Circle */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
              {user.username.charAt(0).toUpperCase()}
            </div>

            {/* User Info */}
            <div className="flex min-w-0 flex-1 flex-col items-start">
              <span className="truncate text-sm font-medium text-white">{user.username}</span>
              <span className="truncate text-xs text-zinc-400">{user.email}</span>
            </div>
          </button>

          {/* Logout Button */}
          <Button variant="ghost" 
            className="w-full justify-start h-11 px-2 text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 border border-white/10"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              logout()
            }}
          >
            <MaterialIcon name="logout" size={20}></MaterialIcon>
            Logout
          </Button>
        </div>
      )}

    </aside>
  )
}
