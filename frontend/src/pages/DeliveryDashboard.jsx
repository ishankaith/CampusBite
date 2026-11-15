
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'

const API_URL = 'http://127.0.0.1:8000'

// Convert an order ID into a valid positive integer.
function getValidOrderId(order) {
  const rawId = order?.id ?? order?.order_id
  const orderId = Number(rawId)

  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return null
  }

  return orderId
}

function DeliveryDashboard() {
  const { token, user } = useAuth()

  const [readyOrders, setReadyOrders] = useState([])
  const [myOrders, setMyOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingOrder, setUpdatingOrder] = useState(null)

  // Common API request function
  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const errorMessage =
        typeof data.detail === 'string'
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail
                .map(item => item.msg || JSON.stringify(item))
                .join(', ')
            : data.detail
              ? JSON.stringify(data.detail)
              : `Request failed (${response.status})`

      throw new Error(errorMessage)
    }

    return data
  }

  // Load available and assigned orders
  async function loadOrders() {
    if (!token || !user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [readyData, assignedData] = await Promise.all([
        apiRequest('/delivery/ready-orders'),
        apiRequest(`/delivery/partners/${user.id}/orders`)
      ])

      setReadyOrders(Array.isArray(readyData) ? readyData : [])
      setMyOrders(Array.isArray(assignedData) ? assignedData : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [token, user?.id])

  // Accept an available delivery
  async function claimOrder(orderId) {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      setError('Invalid order ID. Please refresh the dashboard.')
      return
    }

    setUpdatingOrder(orderId)
    setError('')

    try {
      await apiRequest(
        `/delivery/orders/${orderId}/assign/${user.id}`,
        { method: 'POST' }
      )

      // Refresh after claiming so the order moves into My Deliveries.
      await loadOrders()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingOrder(null)
    }
  }

  // Update delivery status WITHOUT reloading the dashboard
  async function updateStatus(orderId, status) {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      setError('Invalid order ID. Please refresh the dashboard.')
      return
    }

    if (!['Picked Up', 'Out for Delivery', 'Delivered'].includes(status)) {
      setError('Invalid delivery status.')
      return
    }

    setUpdatingOrder(orderId)
    setError('')

    try {
      // First update the backend.
      await apiRequest(`/delivery/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })

      // Update only the relevant order in the existing dashboard.
      // No full-page loading state or dashboard reload.
      setMyOrders(previousOrders =>
        previousOrders.map(order => {
          if (getValidOrderId(order) === orderId) {
            return {
              ...order,
              delivery_status: status
            }
          }

          return order
        })
      )

    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingOrder(null)
    }
  }

  // Determine the next permitted delivery status
  function getNextStatus(status) {
    if (status === 'Assigned') return 'Picked Up'
    if (status === 'Picked Up') return 'Out for Delivery'
    if (status === 'Out for Delivery') return 'Delivered'

    return null
  }

  function getStatusClass(status) {
    return (status || 'unknown').toLowerCase().replaceAll(' ', '-')
  }

  // Render an individual order
  function renderOrder(order, showClaimButton = false) {
    const orderId = getValidOrderId(order)

    const status = order.delivery_status
    const nextStatus = getNextStatus(status)
    const orderNumber = order.order_number || orderId || '—'

    return (
      <article
        className="delivery-order-card"
        key={`order-${orderId ?? orderNumber}`}
      >
        <div className="delivery-order-top">
          <h3>Order #{orderNumber}</h3>

          <span className={`delivery-status ${getStatusClass(status)}`}>
            {status || 'Unknown'}
          </span>
        </div>

        <div className="delivery-order-info">
          <p>
            <strong>Customer:</strong> {order.customer_name}
          </p>

          <p>
            <strong>Phone:</strong> {order.phone}
          </p>

          <p>
            <strong>Delivery Address:</strong> {order.address}
          </p>

          <p>
            <strong>Order Total:</strong> ₹{order.total_amount}
          </p>
        </div>

        {order.restaurant_fulfilments?.length > 0 && (
          <div className="delivery-restaurant-list">
            <strong>Restaurant collection details</strong>

            {order.restaurant_fulfilments.map(fulfilment => (
              <p key={fulfilment.restaurant_id}>
                Restaurant #{fulfilment.restaurant_id} — {fulfilment.status}
              </p>
            ))}
          </div>
        )}

        {showClaimButton && (
          <button
            className="delivery-action-button"
            onClick={() => claimOrder(orderId)}
            disabled={!orderId || updatingOrder === orderId}
          >
            {updatingOrder === orderId
              ? 'Accepting...'
              : 'Accept Delivery'}
          </button>
        )}

        {!showClaimButton && nextStatus && (
          <button
            className="delivery-action-button"
            onClick={() => updateStatus(orderId, nextStatus)}
            disabled={!orderId || updatingOrder === orderId}
          >
            {updatingOrder === orderId
              ? 'Updating...'
              : `Mark as ${nextStatus}`}
          </button>
        )}

        {!orderId && (
          <p className="delivery-error">
            This order has an invalid ID. Refresh the dashboard.
          </p>
        )}
      </article>
    )
  }

  // Check logged-in user
  if (!user || user.role !== 'delivery_partner') {
    return (
      <div className="delivery-dashboard">
        <h2>Please log in with a delivery partner account.</h2>
      </div>
    )
  }

  const activeDeliveries = myOrders.filter(
    order => order.delivery_status !== 'Delivered'
  )

  const completedDeliveries = myOrders.filter(
    order => order.delivery_status === 'Delivered'
  )

  return (
    <DashboardLayout
      role="delivery_partner"
      title="Delivery Dashboard"
      subtitle="Manage available orders and your active deliveries."
    >
      <header className="delivery-header">
        <div>
          <h1>Delivery Dashboard</h1>
          <p>
            Welcome back, {user.name}. Here's your delivery activity.
          </p>
        </div>

        <button
          className="delivery-refresh"
          onClick={loadOrders}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '↻ Refresh Orders'}
        </button>
      </header>

      <section className="delivery-stats">
        <div className="delivery-stat-card">
          <p>Available Orders</p>
          <h2>{readyOrders.length}</h2>
        </div>

        <div className="delivery-stat-card">
          <p>Active Deliveries</p>
          <h2>{activeDeliveries.length}</h2>
        </div>

        <div className="delivery-stat-card">
          <p>Completed Deliveries</p>
          <h2>{completedDeliveries.length}</h2>
        </div>
      </section>

      {error && (
        <div className="delivery-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="delivery-empty">
          Loading your deliveries...
        </div>
      ) : (
        <>
          <section className="delivery-section">
            <h2>Available Orders</h2>

            {readyOrders.length === 0 ? (
              <div className="delivery-empty">
                No orders are currently ready for pickup.
              </div>
            ) : (
              <div className="delivery-order-grid">
                {readyOrders.map(order => renderOrder(order, true))}
              </div>
            )}
          </section>

          <section className="delivery-section">
            <h2>My Deliveries</h2>

            {myOrders.length === 0 ? (
              <div className="delivery-empty">
                You don't have any assigned deliveries yet.
              </div>
            ) : (
              <div className="delivery-order-grid">
                {myOrders.map(order => renderOrder(order))}
              </div>
            )}
          </section>
        </>
      )}
    </DashboardLayout>
  )
}

export default DeliveryDashboard
