import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import flinkLogo from '@/assets/flink.png'

const navItems = [
  { to: '/', label: 'Pipelines' },
]

export default function Sidebar() {
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

    </aside>
  )
}
