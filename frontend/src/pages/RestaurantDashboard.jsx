import { useCallback, useEffect, useState } from 'react'
import '../App.css'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'

const API_URL = 'http://127.0.0.1:8000'

function RestaurantDashboard() {
  const { token, user } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [checkingApplication, setCheckingApplication] = useState(true)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [updatingOrder, setUpdatingOrder] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuSaving, setMenuSaving] = useState(false)
  const [menuDeleting, setMenuDeleting] = useState(null)
  const [editingMenuId, setEditingMenuId] = useState(null)
  const [activeSection, setActiveSection] = useState('orders')
  const [returnRequests, setReturnRequests] = useState([])
  const [customerReviews, setCustomerReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [returnLoading, setReturnLoading] = useState(false)
  const [reviewingReturn, setReviewingReturn] = useState(null)
  const [menuForm, setMenuForm] = useState({ name: '', description: '', price: '' })
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '', cuisine: '', delivery_time: '', price_for_one: '', image: ''
  })

  const authHeaders = { Authorization: `Bearer ${token}` }

  const fetchMyRestaurant = useCallback(async () => {
    if (!token) return
    try {
      setCheckingApplication(true)
      setError('')
      const response = await fetch(`${API_URL}/restaurants/my`, {
        headers: authHeaders
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to check restaurant application')
      setRestaurant(Array.isArray(data) && data.length ? data[0] : null)
    } catch (err) {
      setError(err.message)
    } finally {
      setCheckingApplication(false)
    }
  }, [token])

  const fetchMenu = useCallback(async () => {
    if (!token || !restaurant?.id || restaurant.approval_status !== 'approved') return
    try {
      setMenuLoading(true)
      const response = await fetch(`${API_URL}/restaurants/${restaurant.id}/menu`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to fetch menu items')
      setMenuItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setMenuLoading(false)
    }
  }, [token, restaurant?.id, restaurant?.approval_status])

  const fetchOrders = useCallback(async () => {
    if (!token || !restaurant?.id || restaurant.approval_status !== 'approved') return
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`${API_URL}/orders/restaurant/${restaurant.id}`, {
        headers: authHeaders
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to fetch restaurant orders')
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, restaurant?.id, restaurant?.approval_status])

  const fetchReturnRequests = useCallback(async () => {
    if (!token || !restaurant?.id || restaurant.approval_status !== 'approved') return
    try {
      setReturnLoading(true)
      const response = await fetch(`${API_URL}/admin/restaurants/${restaurant.id}/return-requests`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to load return/refund requests')
      setReturnRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setReturnLoading(false)
    }
  }, [token, restaurant?.id, restaurant?.approval_status])

  const fetchCustomerReviews = useCallback(async () => {
    if (!token || !restaurant?.id || restaurant.approval_status !== 'approved') return
    try {
      setReviewsLoading(true)
      const response = await fetch(`${API_URL}/owner/restaurants/${restaurant.id}/reviews`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to load customer reviews')
      setCustomerReviews(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setReviewsLoading(false)
    }
  }, [token, restaurant?.id, restaurant?.approval_status])

  async function reviewReturnRequest(requestId, decision) {
    const note = window.prompt(decision === 'approve' ? 'Optional note for the customer:' : 'Reason for rejecting this request (optional):')
    if (note === null) return
    try {
      setReviewingReturn(requestId)
      setError('')
      const response = await fetch(`${API_URL}/admin/return-requests/${requestId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, owner_note: note })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to review request')
      setSuccess(data.refund_reference ? `Request approved. Simulated refund reference: ${data.refund_reference}` : data.message)
      await fetchReturnRequests()
    } catch (err) {
      setError(err.message)
    } finally {
      setReviewingReturn(null)
    }
  }

  useEffect(() => { fetchMyRestaurant() }, [fetchMyRestaurant])
  useEffect(() => { if (restaurant?.approval_status === 'approved') fetchOrders() }, [fetchOrders, restaurant?.approval_status])
  useEffect(() => { if (restaurant?.approval_status === 'approved') fetchMenu() }, [fetchMenu, restaurant?.approval_status])
  useEffect(() => { if (restaurant?.approval_status === 'approved') fetchReturnRequests() }, [fetchReturnRequests, restaurant?.approval_status])

  async function submitApplication(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        cuisine: form.cuisine.trim() || null,
        delivery_time: form.delivery_time.trim() || null,
        price_for_one: form.price_for_one === '' ? null : Number(form.price_for_one),
        image: form.image.trim() || null,
        rating: 0
      }
      const response = await fetch(`${API_URL}/restaurants/`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to submit restaurant application')
      setRestaurant(data)
      setSuccess('Your restaurant application has been submitted successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(orderId, status) {
    if (!token || !restaurant?.id) return
    try {
      setUpdatingOrder(orderId)
      setError('')
      const response = await fetch(`${API_URL}/orders/restaurant/${restaurant.id}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to update order status')
      await fetchOrders()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingOrder(null)
    }
  }


  function resetMenuForm() {
    setMenuForm({ name: '', description: '', price: '' })
    setEditingMenuId(null)
  }

  function startEditMenuItem(item) {
    setMenuForm({ name: item.name || '', description: item.description || '', price: String(item.price ?? '') })
    setEditingMenuId(item.id)
    setActiveSection('menu')
    setError('')
    setSuccess('')
  }

  async function saveMenuItem(event) {
    event.preventDefault()
    if (!restaurant?.id) return
    setMenuSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        name: menuForm.name.trim(),
        description: menuForm.description.trim() || null,
        price: Number(menuForm.price),
        restaurant_id: restaurant.id
      }
      const editing = editingMenuId !== null
      const response = await fetch(
        editing ? `${API_URL}/restaurants/menu/${editingMenuId}` : `${API_URL}/restaurants/${restaurant.id}/menu`,
        {
          method: editing ? 'PUT' : 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to save menu item')
      resetMenuForm()
      setSuccess(editing ? 'Menu item updated successfully.' : 'Menu item added successfully.')
      await fetchMenu()
    } catch (err) {
      setError(err.message)
    } finally {
      setMenuSaving(false)
    }
  }

  async function removeMenuItem(itemId) {
    if (!window.confirm('Delete this menu item?')) return
    setMenuDeleting(itemId)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`${API_URL}/restaurants/menu/${itemId}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to delete menu item')
      setSuccess('Menu item deleted successfully.')
      await fetchMenu()
      if (editingMenuId === itemId) resetMenuForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setMenuDeleting(null)
    }
  }

  const placedOrders = orders.filter(order => order.status === 'Placed')
  const preparingOrders = orders.filter(order => order.status === 'Preparing')
  const readyOrders = orders.filter(order => order.status === 'Ready for Pickup')
  const completedOrders = orders.filter(order => order.status === 'Delivered')

  function getStatusClass(status) {
    if (status === 'Placed') return 'status-pending'
    if (status === 'Accepted') return 'status-accepted'
    if (status === 'Preparing') return 'status-preparing'
    if (status === 'Ready for Pickup') return 'status-ready'
    if (status === 'Rejected') return 'status-rejected'
    if (status === 'Delivered') return 'status-accepted'
    if (status === 'Picked Up' || status === 'Out for Delivery' || status === 'Assigned') return 'status-ready'
    return ''
  }

  const fieldStyle = { width: '100%', padding: '11px', marginTop: '6px', border: '1px solid #d5d9e0', borderRadius: '8px', boxSizing: 'border-box' }
  const cardStyle = { background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', maxWidth: '720px' }

  return (
    <DashboardLayout role="restaurant_owner" title="Restaurant Portal" subtitle="Apply to list your restaurant and manage incoming orders.">
      <div className="dashboard-container">
        {checkingApplication ? (
          <p>Checking your restaurant application...</p>
        ) : !restaurant ? (
          <>
            <div className="dashboard-header">
              <div>
                <span className="eyebrow">RESTAURANT ONBOARDING</span>
                <h1>Apply to list your restaurant</h1>
                <p>Welcome, {user?.name || 'Restaurant Owner'}. Complete the form below to submit your restaurant for admin review.</p>
              </div>
            </div>
            <section style={cardStyle}>
              <form onSubmit={submitApplication}>
                <div style={{ marginBottom: 16 }}>
                  <label>Restaurant name *</label>
                  <input style={fieldStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={100} placeholder="e.g. Indian Kitchen" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label>Cuisine</label>
                  <input style={fieldStyle} value={form.cuisine} onChange={e => setForm({ ...form, cuisine: e.target.value })} placeholder="e.g. North Indian, Chinese" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label>Estimated delivery time</label>
                  <input style={fieldStyle} value={form.delivery_time} onChange={e => setForm({ ...form, delivery_time: e.target.value })} placeholder="e.g. 25-35 mins" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label>Average price for one (₹)</label>
                  <input style={fieldStyle} type="number" min="0" value={form.price_for_one} onChange={e => setForm({ ...form, price_for_one: e.target.value })} placeholder="e.g. 200" />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label>Restaurant image URL (optional)</label>
                  <input style={fieldStyle} type="url" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://..." />
                </div>
                {error && <p className="dashboard-error">{error}</p>}
                <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit for Approval'}</button>
              </form>
            </section>
          </>
        ) : restaurant.approval_status === 'pending' ? (
          <section style={cardStyle}>
            <span className="eyebrow">APPLICATION STATUS</span>
            <h1>{restaurant.name}</h1>
            <p><strong>Status:</strong> <span className="status-pending">Pending approval</span></p>
            <p>Your application has been received and is waiting for an administrator to review it. You can return here to check the status.</p>
            {success && <p style={{ color: 'green' }}>{success}</p>}
            {error && <p className="dashboard-error">{error}</p>}
            <button onClick={fetchMyRestaurant} disabled={checkingApplication}>Refresh application status</button>
          </section>
        ) : restaurant.approval_status === 'rejected' ? (
          <section style={cardStyle}>
            <span className="eyebrow">APPLICATION STATUS</span>
            <h1>{restaurant.name}</h1>
            <p><strong>Status:</strong> <span className="status-rejected">Rejected</span></p>
            <p>Your restaurant application was not approved. Please contact the CampusBite administrator for clarification before submitting another application.</p>
            {error && <p className="dashboard-error">{error}</p>}
            <button onClick={fetchMyRestaurant} disabled={checkingApplication}>Refresh status</button>
          </section>
        ) : (
          <>
            <div className="dashboard-header">
              <div>
                <span className="eyebrow">RESTAURANT MANAGEMENT</span>
                <h1>Restaurant Dashboard</h1>
                <p>Welcome, {user?.name || 'Restaurant Owner'}. Manage orders for {restaurant.name}.</p>
              </div>
              <button onClick={fetchOrders} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh Orders'}</button>
            </div>
            <div className="dashboard-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <strong style={{ marginRight: 'auto' }}>Restaurant: {restaurant.name}</strong>
              <button type="button" onClick={() => setActiveSection('orders')} disabled={activeSection === 'orders'}>Manage Orders</button>
              <button type="button" onClick={() => setActiveSection('menu')} disabled={activeSection === 'menu'}>Manage Menu</button>
              <button type="button" onClick={() => { setActiveSection('returns'); fetchReturnRequests() }} disabled={activeSection === 'returns'}>Returns & Refunds</button>
              <button type="button" onClick={() => { setActiveSection('reviews'); fetchCustomerReviews() }} disabled={activeSection === 'reviews'}>Customer Reviews</button>
            </div>
            {success && <p style={{ color: '#18794e', margin: '12px 0' }}>{success}</p>}
            {activeSection === 'reviews' ? (
              <section className="dashboard-orders" style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2>Customer Reviews</h2>
                  <button type="button" onClick={fetchCustomerReviews} disabled={reviewsLoading}>{reviewsLoading ? 'Refreshing...' : 'Refresh Reviews'}</button>
                </div>
                {reviewsLoading && <p>Loading reviews...</p>}
                {!reviewsLoading && customerReviews.length === 0 && <p>No customer reviews have been submitted yet.</p>}
                {customerReviews.map(review => (
                  <article className="dashboard-order-card" key={review.id}>
                    <h3>{review.customer_name} — <span style={{ color: '#d69e2e' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></h3>
                    <p>{review.comment}</p>
                    {Array.isArray(review.ordered_items) && review.ordered_items.length > 0 && (
                      <p><strong>Ordered:</strong> {review.ordered_items.map(item => `${item.item_name} × ${item.quantity}`).join(', ')}</p>
                    )}
                    <small>{review.created_at ? new Date(review.created_at).toLocaleString('en-IN') : ''}</small>
                    <p><strong>Order:</strong> CB{String(review.order_id).padStart(6, '0')}</p>
                  </article>
                ))}
              </section>
            ) : activeSection === 'returns' ? (

              <section className="dashboard-orders" style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2>Return & Refund Requests</h2>
                  <button type="button" onClick={fetchReturnRequests} disabled={returnLoading}>{returnLoading ? 'Refreshing...' : 'Refresh Requests'}</button>
                </div>
                {returnLoading && <p>Loading requests...</p>}
                {!returnLoading && returnRequests.length === 0 && <p>No return/refund requests have been submitted.</p>}
                {returnRequests.map(item => (
                  <article className="dashboard-order-card" key={item.id}>
                    <div>
                      <h3>{item.order_number}</h3>
                      <p><strong>Customer:</strong> {item.customer_name}</p>
                      <p><strong>Reason:</strong> {item.reason}</p>
                      <p><strong>Amount:</strong> ₹{Number(item.amount).toFixed(2)}</p>
                      <p><strong>Payment:</strong> {item.payment_method || 'Unknown'} — {item.payment_status || 'Not recorded'}</p>
                      <p><strong>Request status:</strong> {item.status}</p>
                      {item.owner_note && <p><strong>Previous note:</strong> {item.owner_note}</p>}
                    </div>
                    {item.status === 'pending' && <div className="dashboard-actions">
                      <button type="button" disabled={reviewingReturn === item.id} onClick={() => reviewReturnRequest(item.id, 'approve')}>Approve</button>
                      <button type="button" disabled={reviewingReturn === item.id} onClick={() => reviewReturnRequest(item.id, 'reject')}>Reject</button>
                    </div>}
                  </article>
                ))}
              </section>
            ) : activeSection === 'menu' ? (
              <section className="dashboard-orders" style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2>Menu Management</h2>
                  <button type="button" onClick={fetchMenu} disabled={menuLoading}>{menuLoading ? 'Refreshing...' : 'Refresh Menu'}</button>
                </div>
                <p>Add and maintain the dishes customers can order from {restaurant.name}.</p>
                <form onSubmit={saveMenuItem} style={{ ...cardStyle, maxWidth: '100%', margin: '18px 0' }}>
                  <h3>{editingMenuId ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
                  <div style={{ marginBottom: 14 }}>
                    <label>Item name *</label>
                    <input style={fieldStyle} value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} required minLength={2} maxLength={100} placeholder="e.g. Paneer Butter Masala" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label>Description</label>
                    <textarea style={{ ...fieldStyle, minHeight: 75, resize: 'vertical' }} value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Brief description of the dish" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label>Price (₹) *</label>
                    <input style={fieldStyle} type="number" min="0.01" step="0.01" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} required placeholder="e.g. 180" />
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="submit" disabled={menuSaving}>{menuSaving ? 'Saving...' : editingMenuId ? 'Save Changes' : 'Add Menu Item'}</button>
                    {editingMenuId && <button type="button" onClick={resetMenuForm}>Cancel Edit</button>}
                  </div>
                </form>
                {menuLoading ? <p>Loading menu...</p> : menuItems.length === 0 ? <p>No menu items yet. Add your first dish using the form above.</p> : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {menuItems.map(item => (
                      <article key={item.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div><h3 style={{ margin: '0 0 5px' }}>{item.name}</h3><p style={{ margin: '0 0 5px' }}>{item.description || 'No description provided'}</p><strong>₹{Number(item.price).toFixed(2)}</strong></div>
                        <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => startEditMenuItem(item)}>Edit</button><button type="button" disabled={menuDeleting === item.id} onClick={() => removeMenuItem(item.id)}>{menuDeleting === item.id ? 'Deleting...' : 'Delete'}</button></div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : (<>
            <div className="dashboard-stats">
              <div className="dashboard-stat"><span>Total Orders</span><strong>{orders.length}</strong></div>
              <div className="dashboard-stat"><span>New Orders</span><strong>{placedOrders.length}</strong></div>
              <div className="dashboard-stat"><span>Preparing</span><strong>{preparingOrders.length}</strong></div>
              <div className="dashboard-stat"><span>Ready for Pickup</span><strong>{readyOrders.length}</strong></div>
              <div className="dashboard-stat"><span>Completed</span><strong>{completedOrders.length}</strong></div>
            </div>
            <section className="dashboard-orders">
              <h2>Incoming Orders</h2>
              {loading && <p>Loading orders...</p>}
              {error && <p className="dashboard-error">{error}</p>}
              {!loading && !error && orders.length === 0 && <p>No orders found for {restaurant.name}.</p>}
              {orders.map(order => (
                <article className="dashboard-order-card" key={order.id}>
                  <div>
                    <h3>{order.order_number}</h3>
                    <p><strong>Customer:</strong> {order.customer_name}</p>
                    <p><strong>Phone:</strong> {order.phone}</p>
                    <p><strong>Address:</strong> {order.address}</p>
                  </div>
                  <div>
                    <strong>₹{order.restaurant_subtotal}</strong>
                    <p>Status: <span className={getStatusClass(order.status)}>{order.status}</span></p>
                    {order.delivery_status && order.delivery_status !== 'Unassigned' && <p>Delivery: <span className={getStatusClass(order.delivery_status)}>{order.delivery_status}</span></p>}
                  </div>
                  <div>
                    <strong>Items</strong>
                    {order.items.map((item, index) => <p key={index}>{item.item_name} × {item.quantity}</p>)}
                  </div>
                  <div className="dashboard-actions">
                    {order.status === 'Placed' && <>
                      <button disabled={updatingOrder === order.id} onClick={() => updateStatus(order.id, 'Accepted')}>Accept</button>
                      <button disabled={updatingOrder === order.id} onClick={() => updateStatus(order.id, 'Rejected')}>Reject</button>
                    </>}
                    {order.status === 'Accepted' && <>
                      <button disabled={updatingOrder === order.id} onClick={() => updateStatus(order.id, 'Preparing')}>Start Preparing</button>
                      <button disabled={updatingOrder === order.id} onClick={() => updateStatus(order.id, 'Rejected')}>Reject</button>
                    </>}
                    {order.status === 'Preparing' && <button disabled={updatingOrder === order.id} onClick={() => updateStatus(order.id, 'Ready for Pickup')}>Ready for Pickup</button>}
                    {order.status === 'Ready for Pickup' && <p>Waiting for delivery partner pickup.</p>}
                    {order.status === 'Picked Up' && <p>Order has been picked up by the delivery partner.</p>}
                    {order.status === 'Out for Delivery' && <p>Order is out for delivery.</p>}
                    {order.status === 'Delivered' && <p>Order successfully delivered.</p>}
                    {order.status === 'Rejected' && <p>This restaurant fulfilment was rejected.</p>}
                    {updatingOrder === order.id && <p>Updating order...</p>}
                  </div>
                </article>
              ))}
            </section>
            </>)}
          </>
        )}
        {error && restaurant && restaurant.approval_status === 'approved' && <p className="dashboard-error">{error}</p>}
      </div>
    </DashboardLayout>
  )
}

export default RestaurantDashboard
