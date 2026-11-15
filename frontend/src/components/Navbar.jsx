
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const { totalItems } = useCart()
  const { user, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isCustomer = user?.role === 'customer'
  const isRestaurantOwner = user?.role === 'restaurant_owner'
  const isDeliveryPartner = user?.role === 'delivery_partner'
  const isAdmin = user?.role === 'admin'

  return (
    <header className="navbar">
      <Link className="brand" to="/">
        <span className="brand-icon">C</span>
        <span>CampusBite</span>
      </Link>

      <nav className="nav-links">
        <Link to="/#home">Home</Link>

        {(!isLoggedIn || isCustomer) && (
          <>
            <Link to="/#restaurants">Restaurants</Link>
            <Link to="/#how-it-works">How it works</Link>
          </>
        )}

        {isLoggedIn && isCustomer && (
          <>
            <Link to="/orders">My Orders</Link>
            <Link to="/ai-assistant">AI Assistant</Link>
          </>
        )}

        {isLoggedIn && isRestaurantOwner && (
          <Link to="/restaurant-dashboard">
            Restaurant Dashboard
          </Link>
        )}

        {isLoggedIn && isDeliveryPartner && (
          <Link to="/delivery-dashboard">
            Delivery Dashboard
          </Link>
        )}

        {isLoggedIn && isAdmin && (
          <Link to="/admin-dashboard">
            Admin Dashboard
          </Link>
        )}
      </nav>

      <div className="nav-actions">
        {(!isLoggedIn || isCustomer) && (
          <Link className="cart-link" to="/cart">
            <span>Cart ({totalItems})</span>
            <span aria-hidden="true">🛒</span>
          </Link>
        )}

        {isLoggedIn ? (
          <>
            <span className="user-name">
              {user?.name || 'Account'}
            </span>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="login-link">
              Login
            </Link>

            <Link to="/register" className="register-link">
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  )
}

export default Navbar
