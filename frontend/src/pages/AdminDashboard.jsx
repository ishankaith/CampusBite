
import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'

const API_URL = 'http://127.0.0.1:8000'

function AdminDashboard() {
  const { token } = useAuth()

  const [restaurants, setRestaurants] = useState([])
  const [payments, setPayments] = useState([])
  const [cancellations, setCancellations] = useState([])
  const [refunds, setRefunds] = useState([])
  const [cancellationError, setCancellationError] = useState('')
  const [reviewingId, setReviewingId] = useState(null)
  const [paymentError, setPaymentError] = useState('')
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const fetchRestaurants = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/admin/restaurants`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Unable to load restaurant applications.')
      }

      const data = await response.json()
      setRestaurants(data)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchPayments = useCallback(async () => {
    try {
      setPaymentsLoading(true)
      setPaymentError('')

      const response = await fetch(`${API_URL}/admin/payment-transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Unable to load payment transactions.')
      }

      setPayments(await response.json())
    } catch (err) {
      setPaymentError(err.message || 'Unable to load payment transactions.')
    } finally {
      setPaymentsLoading(false)
    }
  }, [token])

  const fetchCancellations = useCallback(async () => {
    try {
      setCancellationError('')
      const [cancellationResponse, refundResponse] = await Promise.all([
        fetch(`${API_URL}/admin/cancellation-requests`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/refund-transactions`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      if (!cancellationResponse.ok || !refundResponse.ok) throw new Error('Unable to load cancellation or refund records.')
      setCancellations(await cancellationResponse.json())
      setRefunds(await refundResponse.json())
    } catch (err) {
      setCancellationError(err.message || 'Unable to load cancellation records.')
    }
  }, [token])

  useEffect(() => {
    fetchRestaurants()
    fetchPayments()
    fetchCancellations()
  }, [fetchRestaurants, fetchPayments, fetchCancellations])

  async function reviewCancellation(requestId, decision) {
    try {
      setReviewingId(requestId)
      setCancellationError('')
      const response = await fetch(`${API_URL}/admin/cancellation-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to review cancellation request.')
      await Promise.all([fetchCancellations(), fetchPayments()])
      window.alert(data.message + (data.refund_reference ? ` Refund reference: ${data.refund_reference}` : ''))
    } catch (err) {
      setCancellationError(err.message || 'Unable to review cancellation request.')
    } finally {
      setReviewingId(null)
    }
  }

  async function updateApplication(restaurantId, action) {
    try {
      setUpdatingId(restaurantId)
      setError('')

      const response = await fetch(
        `${API_URL}/admin/restaurants/${restaurantId}/${action}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Unable to ${action} this restaurant.`)
      }

      await fetchRestaurants()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setUpdatingId(null)
    }
  }

  const pendingCount = restaurants.filter(
    (restaurant) => restaurant.approval_status === 'pending'
  ).length

  const approvedCount = restaurants.filter(
    (restaurant) => restaurant.approval_status === 'approved'
  ).length

  const rejectedCount = restaurants.filter(
    (restaurant) => restaurant.approval_status === 'rejected'
  ).length

  return (
    <DashboardLayout
      role="admin"
      title="Admin Dashboard"
      subtitle="Review restaurant applications and manage platform approvals."
    >
      <section className="dashboard-stats">
        <div className="dashboard-stat">
          <span>Total Applications</span>
          <strong>{restaurants.length}</strong>
        </div>

        <div className="dashboard-stat">
          <span>Pending Review</span>
          <strong>{pendingCount}</strong>
        </div>

        <div className="dashboard-stat">
          <span>Approved</span>
          <strong>{approvedCount}</strong>
        </div>

        <div className="dashboard-stat">
          <span>Rejected</span>
          <strong>{rejectedCount}</strong>
        </div>
      </section>

      <section className="dashboard-orders">
        <div className="admin-section-header">
          <div>
            <h2>Restaurant Applications</h2>
            <p>Review and manage restaurant registration requests.</p>
          </div>

          <button
            type="button"
            className="admin-refresh-button"
            onClick={fetchRestaurants}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <p>Loading restaurant applications...</p>
        ) : restaurants.length === 0 ? (
          <p>No restaurant applications found.</p>
        ) : (
          <div className="admin-restaurant-list">
            {restaurants.map((restaurant) => (
              <article className="admin-restaurant-card" key={restaurant.id}>
                <div className="admin-restaurant-info">
                  <h3>{restaurant.name}</h3>
                  <p>{restaurant.cuisine || 'Cuisine not specified'}</p>
                  <span>Restaurant ID: {restaurant.id}</span>
                </div>

                <div className="admin-restaurant-actions">
                  <span
                    className={`admin-status ${restaurant.approval_status}`}
                  >
                    {restaurant.approval_status}
                  </span>

                  {restaurant.approval_status === 'pending' && (
                    <div className="admin-action-buttons">
                      <button
                        type="button"
                        className="admin-approve-button"
                        onClick={() =>
                          updateApplication(restaurant.id, 'approve')
                        }
                        disabled={updatingId === restaurant.id}
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        className="admin-reject-button"
                        onClick={() =>
                          updateApplication(restaurant.id, 'reject')
                        }
                        disabled={updatingId === restaurant.id}
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {updatingId === restaurant.id && (
                    <small>Updating...</small>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-orders">
        <div className="admin-section-header">
          <div>
            <h2>Payment Ledger</h2>
            <p>Recorded payment transactions for CampusBite orders.</p>
          </div>

          <button
            type="button"
            className="admin-refresh-button"
            onClick={fetchPayments}
            disabled={paymentsLoading}
          >
            Refresh payments
          </button>
        </div>

        {paymentError && <p className="admin-error">{paymentError}</p>}

        {paymentsLoading ? (
          <p>Loading payment transactions...</p>
        ) : payments.length === 0 ? (
          <p>No payment transactions recorded yet.</p>
        ) : (
          <div className="admin-restaurant-list">
            {payments.map((payment) => (
              <article className="admin-restaurant-card" key={payment.id}>
                <div className="admin-restaurant-info">
                  <h3>{payment.order_number} · {payment.customer_name}</h3>
                  <p>{payment.transaction_reference}</p>
                  <span>{payment.payment_method === 'cod' ? 'Cash on Delivery' : 'Dummy Online Payment'}</span>
                </div>
                <div className="admin-restaurant-actions">
                  <strong>₹{Number(payment.amount).toFixed(2)}</strong>
                  <span className={`admin-status ${payment.payment_status}`}>
                    {payment.payment_status === 'paid_simulated' ? 'Paid (Simulated)' : payment.payment_status === 'refunded' ? 'Refunded' : payment.payment_status === 'cancelled' ? 'Cancelled' : 'Pending'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-orders">
        <div className="admin-section-header">
          <div><h2>Cancellation Requests</h2><p>Approve eligible cancellations or reject requests.</p></div>
          <button type="button" className="admin-refresh-button" onClick={fetchCancellations}>Refresh requests</button>
        </div>
        {cancellationError && <p className="admin-error">{cancellationError}</p>}
        {cancellations.length === 0 ? <p>No cancellation requests.</p> : (
          <div className="admin-restaurant-list">
            {cancellations.map((item) => (
              <article className="admin-restaurant-card" key={item.id}>
                <div className="admin-restaurant-info">
                  <h3>{item.order_number} · {item.customer_name}</h3>
                  <p>{item.reason}</p>
                  <span>₹{Number(item.amount).toFixed(2)} · {item.payment_method || 'Payment not recorded'} · {item.payment_status || 'N/A'}</span>
                </div>
                <div className="admin-restaurant-actions">
                  <span className={`admin-status ${item.status}`}>{item.status}</span>
                  {item.status === 'pending' && <div className="admin-action-buttons">
                    <button className="admin-approve-button" disabled={reviewingId === item.id} onClick={() => reviewCancellation(item.id, 'approve')}>Approve</button>
                    <button className="admin-reject-button" disabled={reviewingId === item.id} onClick={() => reviewCancellation(item.id, 'reject')}>Reject</button>
                  </div>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-orders">
        <div className="admin-section-header"><div><h2>Refund Records</h2><p>Audit trail for simulated online-payment refunds.</p></div></div>
        {refunds.length === 0 ? <p>No refunds have been issued.</p> : (
          <div className="admin-restaurant-list">
            {refunds.map((refund) => <article className="admin-restaurant-card" key={refund.id}>
              <div className="admin-restaurant-info"><h3>{refund.order_number}</h3><p>{refund.refund_reference}</p><span>{refund.reason}</span></div>
              <div className="admin-restaurant-actions"><strong>₹{Number(refund.amount).toFixed(2)}</strong><span className="admin-status refunded">{refund.status}</span></div>
            </article>)}
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}

export default AdminDashboard
