
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function DashboardLayout({ title, subtitle, children, role }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const isRestaurant = role === 'restaurant_owner'
  const isDelivery = role === 'delivery_partner'
  const isAdmin = role === 'admin'

  const dashboardTitle = isRestaurant
    ? 'Restaurant Portal'
    : isAdmin
      ? 'Admin Portal'
      : 'Delivery Partner Portal'

  const dashboardPath = isRestaurant
    ? '/restaurant-dashboard'
    : isAdmin
      ? '/admin-dashboard'
      : '/delivery-dashboard'

  const roleLabel = isRestaurant
    ? 'Restaurant Owner'
    : isAdmin
      ? 'Administrator'
      : 'Delivery Partner'

  const workspaceLabel = isRestaurant
    ? 'Manage Orders'
    : isAdmin
      ? 'Restaurant Applications'
      : 'My Deliveries'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="portal-layout">
      <aside className="portal-sidebar">

        <div className="portal-brand">
          <span className="portal-brand-mark">C</span>

          <div>
            <h2>CampusBite</h2>
            <span>{dashboardTitle}</span>
          </div>
        </div>

        <div className="portal-profile">
          <div className="portal-avatar">
            {(user?.name || user?.full_name || 'U')
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="portal-profile-info">
            <strong>
              {user?.name || user?.full_name || 'User'}
            </strong>

            <span>{roleLabel}</span>
          </div>
        </div>

        <nav className="portal-navigation">
          <span className="portal-nav-heading">
            WORKSPACE
          </span>

          <NavLink
            to={dashboardPath}
            end
            className={({ isActive }) =>
              `portal-nav-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="portal-nav-icon">▦</span>
            Overview
          </NavLink>

          <a
            className="portal-nav-link"
            href="#dashboard-content"
          >
            <span className="portal-nav-icon">≡</span>
            {workspaceLabel}
          </a>
        </nav>

        <div className="portal-sidebar-bottom">
          <button
            type="button"
            className="portal-logout"
            onClick={handleLogout}
          >
            <span className="portal-nav-icon">↪</span>
            Log out
          </button>

          <span className="portal-version">
            CampusBite Management
          </span>
        </div>

      </aside>

      <div className="portal-main">

        <header className="portal-topbar">
          <div>
            <span className="portal-topbar-label">
              {dashboardTitle}
            </span>

            <h1>{title}</h1>
          </div>

          <div className="portal-topbar-user">
            <span>
              {user?.name || user?.full_name || 'Welcome'}
            </span>

            <div className="portal-avatar small">
              {(user?.name || user?.full_name || 'U')
                .charAt(0)
                .toUpperCase()}
            </div>
          </div>
        </header>

        <main
          className="portal-content"
          id="dashboard-content"
        >
          {subtitle && (
            <p className="portal-subtitle">
              {subtitle}
            </p>
          )}

          {children}
        </main>

      </div>
    </div>
  )
}

export default DashboardLayout
