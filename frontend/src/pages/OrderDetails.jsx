
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder } from '../services/api'
import '../App.css'

function OrderDetails() {
  const { orderId } = useParams()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelMessage, setCancelMessage] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnMessage, setReturnMessage] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  useEffect(() => {
    let isActive = true

    async function fetchOrder() {
      try {
        setLoading(true)
        setError('')
        setOrder(null)

        const data = await getOrder(orderId)

        if (isActive) {
          setOrder(data)
        }
      } catch (err) {
        console.error('Error fetching order:', err)

        if (isActive) {
          setError(err.message || 'Unable to retrieve order details.')
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    fetchOrder()

    return () => {
      isActive = false
    }
  }, [orderId])

  async function submitReturnRequest() {
    if (returnReason.trim().length < 5) {
      setReturnMessage('Please provide a reason of at least 5 characters.')
      return
    }
    try {
      setReturnSubmitting(true)
      setReturnMessage('')
      const token = localStorage.getItem('campusbite_token')
      const response = await fetch(`http://127.0.0.1:8000/orders/${encodeURIComponent(orderId)}/return-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: returnReason.trim() })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to submit return/refund request.')
      setOrder(previous => ({ ...previous, return_request: data.return_request }))
      setReturnMessage('Return/refund request submitted to the restaurant for review.')
    } catch (err) {
      setReturnMessage(err.message || 'Unable to submit return/refund request.')
    } finally {
      setReturnSubmitting(false)
    }
  }

  async function submitReview() {
    if (reviewComment.trim().length < 3) {
      setReviewMessage('Please write at least 3 characters.')
      return
    }
    try {
      setReviewSubmitting(true)
      setReviewMessage('')
      const token = localStorage.getItem('campusbite_token')
      const response = await fetch(`http://127.0.0.1:8000/orders/${encodeURIComponent(orderId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating: Number(reviewRating), comment: reviewComment.trim() })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to submit review.')
      setOrder(previous => ({ ...previous, review: data.review }))
      setReviewMessage('Thank you! Your review has been submitted.')
    } catch (err) {
      setReviewMessage(err.message || 'Unable to submit review.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  async function submitCancellation() {
    if (cancelReason.trim().length < 5) {
      setCancelMessage('Please provide a reason of at least 5 characters.')
      return
    }
    try {
      setCancelSubmitting(true)
      setCancelMessage('')
      const token = localStorage.getItem('campusbite_token')
      const response = await fetch(`http://127.0.0.1:8000/orders/${encodeURIComponent(orderId)}/cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason.trim() })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to submit cancellation request.')
      setOrder((previous) => ({ ...previous, cancellation: data.cancellation, can_request_cancellation: false }))
      setCancelMessage('Cancellation request submitted. An administrator will review it.')
    } catch (err) {
      setCancelMessage(err.message || 'Unable to submit cancellation request.')
    } finally {
      setCancelSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="checkout-page">
        <div className="checkout-container">
          <p>Loading order details...</p>
        </div>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="checkout-page">
        <div className="empty-cart">
          <h1>Order not found</h1>
          <p>{error || 'We could not find this order.'}</p>

          <Link to="/orders" className="checkout-button">
            Back to My Orders
          </Link>
        </div>
      </main>
    )
  }

  const orderNumber =
    order.order_number || `CB${String(order.id).padStart(6, '0')}`

  const items = Array.isArray(order.items) ? order.items : []

  return (
    <main className="checkout-page">
      <div className="checkout-container">

        <div className="checkout-heading">
          <span className="eyebrow">ORDER INFORMATION</span>
          <h1>Order Details</h1>
          <p>Your CampusBite order information.</p>
        </div>

        <section className="checkout-section">

          <div className="summary-row">
            <strong>Order number</strong>
            <strong>{orderNumber}</strong>
          </div>

          <div className="summary-row">
            <strong>Order status</strong>
            <strong>{order.status}</strong>
          </div>

          <div className="summary-row">
            <strong>Customer name</strong>
            <span>{order.customer_name}</span>
          </div>

          <div className="summary-row">
            <strong>Phone number</strong>
            <span>{order.phone}</span>
          </div>

          <div className="summary-row">
            <strong>Delivery address</strong>
            <span>{order.address}</span>
          </div>

        </section>

        <section className="checkout-section">
          <h2>Payment information</h2>
          <div className="summary-row">
            <strong>Payment method</strong>
            <span>{order.payment?.payment_method === 'cod' ? 'Cash on Delivery' : order.payment?.payment_method === 'online' ? 'Dummy Online Payment' : 'Not recorded (older order)'}</span>
          </div>
          <div className="summary-row">
            <strong>Payment status</strong>
            <span>{order.payment?.payment_status === 'paid_simulated' ? 'Paid (Simulated)' : order.payment?.payment_status === 'pending' ? 'Pending' : 'Not available'}</span>
          </div>
          {order.payment?.transaction_reference && (
            <div className="summary-row">
              <strong>Transaction reference</strong>
              <span>{order.payment.transaction_reference}</span>
            </div>
          )}
        </section>

        <section className="checkout-section">
          <h2>Cancellation</h2>
          {order.cancellation ? (
            <>
              <div className="summary-row"><strong>Request status</strong><span>{order.cancellation.status}</span></div>
              <div className="summary-row"><strong>Reason</strong><span>{order.cancellation.reason}</span></div>
              {order.cancellation.admin_note && <p>Admin note: {order.cancellation.admin_note}</p>}
            </>
          ) : order.can_request_cancellation ? (
            <>
              <p>You may request cancellation before restaurant preparation or delivery begins. Approval is subject to admin review.</p>
              <label htmlFor="cancel-reason">Reason for cancellation</label>
              <textarea id="cancel-reason" rows="3" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Tell us why you want to cancel this order." />
              <button type="button" className="checkout-button" disabled={cancelSubmitting} onClick={submitCancellation}>{cancelSubmitting ? 'Submitting...' : 'Request cancellation'}</button>
            </>
          ) : (
            <p>This order is no longer eligible for cancellation because preparation or delivery may have started.</p>
          )}
          {cancelMessage && <p role="status">{cancelMessage}</p>}
        </section>

        <section className="checkout-section">
          <h2>Return / Refund</h2>
          {order.return_request ? (
            <>
              <div className="summary-row"><strong>Request status</strong><span>{order.return_request.status}</span></div>
              <div className="summary-row"><strong>Reason</strong><span>{order.return_request.reason}</span></div>
              {order.return_request.owner_note && <p>Restaurant note: {order.return_request.owner_note}</p>}
            </>
          ) : order.status === 'Delivered' ? (
            <>
              <p>Your order has been delivered. You may submit one return/refund request for the restaurant to review.</p>
              <label htmlFor="return-reason">Reason for return/refund</label>
              <textarea id="return-reason" rows="3" value={returnReason} onChange={event => setReturnReason(event.target.value)} placeholder="Describe the issue with your order." />
              <button type="button" className="checkout-button" disabled={returnSubmitting} onClick={submitReturnRequest}>{returnSubmitting ? 'Submitting...' : 'Request return / refund'}</button>
            </>
          ) : (
            <p>Return/refund requests become available after the order is delivered.</p>
          )}
          {returnMessage && <p role="status">{returnMessage}</p>}
        </section>

        <section className="checkout-section">
          <h2>Rate your experience</h2>
          {order.review ? (
            <>
              <p><strong>Your rating:</strong> {'★'.repeat(order.review.rating)}{'☆'.repeat(5 - order.review.rating)}</p>
              <p>{order.review.comment}</p>
              {Array.isArray(order.review.ordered_items) && order.review.ordered_items.length > 0 && (
                <p><strong>Dishes reviewed:</strong> {order.review.ordered_items.map(item => `${item.item_name} × ${item.quantity}`).join(', ')}</p>
              )}
            </>
          ) : order.status === 'Delivered' ? (
            <>
              <p>Share your experience with this restaurant.</p>
              <label htmlFor="review-rating">Rating</label>
              <select id="review-rating" value={reviewRating} onChange={event => setReviewRating(event.target.value)} style={{ display: 'block', margin: '8px 0 14px', padding: 10, borderRadius: 8 }}>
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Very good</option>
                <option value="3">3 - Good</option>
                <option value="2">2 - Fair</option>
                <option value="1">1 - Poor</option>
              </select>
              <label htmlFor="review-comment">Your review</label>
              <textarea id="review-comment" rows="3" value={reviewComment} onChange={event => setReviewComment(event.target.value)} placeholder="Tell us about your experience (at least 3 characters)." />
              <button type="button" className="checkout-button" disabled={reviewSubmitting} onClick={submitReview}>{reviewSubmitting ? 'Submitting...' : 'Submit review'}</button>
            </>
          ) : (
            <p>You can rate and review this order after it has been delivered.</p>
          )}
          {reviewMessage && <p role="status">{reviewMessage}</p>}
        </section>

        <section className="checkout-summary">
          <h2>Items ordered</h2>

          {items.length > 0 ? (
            items.map((item, index) => (
              <div
                className="summary-row"
                key={`${item.menu_item_id}-${index}`}
              >
                <span>
                  {item.item_name} × {item.quantity}
                </span>

                <strong>
                  ₹{Number(item.price) * Number(item.quantity)}
                </strong>
              </div>
            ))
          ) : (
            <p>No item details are available for this order.</p>
          )}

          <div className="summary-divider"></div>

          <div className="summary-row summary-total">
            <strong>Total amount</strong>
            <strong>₹{order.total_amount}</strong>
          </div>
        </section>

        <div style={{ marginTop: '24px' }}>
          <Link to="/orders" className="back-link">
            ← Back to My Orders
          </Link>
        </div>

      </div>
    </main>
  )
}

export default OrderDetails
