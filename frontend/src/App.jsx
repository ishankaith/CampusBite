
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from 'react-router-dom'

import Navbar from './components/Navbar'
import Home from './pages/Home'
import Restaurant from './pages/Restaurants'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import MyOrders from './pages/MyOrders'
import AIAssistant from './pages/AIAssistant'
import OrderDetails from './pages/OrderDetails'
import RestaurantDashboard from './pages/RestaurantDashboard'
import DeliveryDashboard from './pages/DeliveryDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Login from './pages/Login'
import Register from './pages/Register'

import { CartProvider } from './context/CartContext'
import { AuthProvider, useAuth } from './context/AuthContext'

function RestaurantOwnerRoute({ children }) {
  const { isLoggedIn, user } = useAuth()

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'restaurant_owner') {
    return <Navigate to="/" replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { isLoggedIn, user } = useAuth()

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}

function AppContent() {
  const location = useLocation()

  const isDashboard =
    location.pathname === '/restaurant-dashboard' ||
    location.pathname === '/delivery-dashboard' ||
    location.pathname === '/admin-dashboard'

  return (
    <>
      {!isDashboard && <Navbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/restaurant/:id" element={<Restaurant />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<MyOrders />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/orders/:orderId" element={<OrderDetails />} />

        <Route
          path="/restaurant-dashboard"
          element={
            <RestaurantOwnerRoute>
              <RestaurantDashboard />
            </RestaurantOwnerRoute>
          }
        />

        <Route
          path="/delivery-dashboard"
          element={<DeliveryDashboard />}
        />

        <Route
          path="/admin-dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
