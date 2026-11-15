
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMyOrders } from '../services/api'
import { useAuth } from '../context/AuthContext'
import '../App.css'

function formatDate(dateValue) {
    if (!dateValue) return 'Date unavailable'

    const date = new Date(dateValue)

    if (Number.isNaN(date.getTime())) return 'Date unavailable'

    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
}

function formatTime(dateValue) {
    if (!dateValue) return ''

    const date = new Date(dateValue)

    if (Number.isNaN(date.getTime())) return ''

    return date.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
}

function groupOrdersByDate(orders) {
    const groups = {}

    orders.forEach((order) => {
        const date = order.created_at ? new Date(order.created_at) : null

        const key =
            date && !Number.isNaN(date.getTime())
                ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                : 'unknown-date'

        if (!groups[key]) {
            groups[key] = {
                heading: formatDate(order.created_at),
                orders: [],
            }
        }

        groups[key].orders.push(order)
    })

    return Object.values(groups)
}

function MyOrders() {
    const { isLoggedIn, user } = useAuth()
    const navigate = useNavigate()

    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/login', { replace: true })
            return
        }

        let isActive = true

        async function loadOrders() {
            try {
                setLoading(true)
                setError('')

                const data = await getMyOrders()

                if (isActive) {
                    setOrders(data)
                }
            } catch (err) {
                if (isActive) {
                    setError(err.message || 'Unable to load your orders')
                }
            } finally {
                if (isActive) {
                    setLoading(false)
                }
            }
        }

        loadOrders()

        return () => {
            isActive = false
        }
    }, [isLoggedIn, navigate])

    const orderGroups = groupOrdersByDate(orders)

    if (!isLoggedIn) return null

    return (
        <main className="checkout-page">
            <div className="checkout-container">

                <div className="checkout-heading">
                    <span className="eyebrow">YOUR ORDER HISTORY</span>
                    <h1>My Orders</h1>
                    <p>
                        Welcome{user?.name ? `, ${user.name}` : ''}.
                        Here you can track your previous orders.
                    </p>
                </div>

                {loading && (
                    <div className="empty-cart">
                        <h2>Loading your orders...</h2>
                        <p>Please wait while we retrieve your order history.</p>
                    </div>
                )}

                {error && !loading && (
                    <div className="checkout-error" role="alert">
                        <p>{error}</p>
                        <button
                            className="checkout-button"
                            onClick={() => window.location.reload()}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {!loading && !error && orders.length === 0 && (
                    <div className="empty-cart">
                        <h2>No orders yet</h2>
                        <p>
                            Your orders will appear here after you place
                            your first order using this account.
                        </p>
                        <Link to="/" className="checkout-button">
                            Explore restaurants
                        </Link>
                    </div>
                )}

                {!loading && !error && orders.length > 0 && (
                    <section className="menu-section">
                        <span className="eyebrow">PREVIOUS ORDERS</span>
                        <h2>Your order history</h2>

                        {orderGroups.map((group) => (
                            <div className="order-date-group" key={group.heading}>
                                <h3 className="order-date-heading">
                                    {group.heading}
                                </h3>

                                <div className="menu-list">
                                    {group.orders.map((order) => (
                                        <article
                                            className="menu-item"
                                            key={order.id}
                                        >
                                            <div className="menu-item-info">
                                                <h3>{order.order_number}</h3>

                                                <p>
                                                    <strong>Time:</strong>{' '}
                                                    {formatTime(order.created_at)}
                                                </p>

                                                <p>
                                                    <strong>Status:</strong>{' '}
                                                    {order.status}
                                                </p>

                                                {order.cancellation && <p><strong>Cancellation request:</strong> {order.cancellation.status}</p>}
                                                {order.return_request && <p><strong>Return/refund request:</strong> {order.return_request.status}</p>}

                                                <p>
                                                    <strong>Payment:</strong>{' '}
                                                    {order.payment?.payment_method === 'cod' ? 'Cash on Delivery' : order.payment?.payment_method === 'online' ? 'Dummy Online Payment' : 'Not recorded (older order)'}
                                                    {order.payment?.payment_status ? ` — ${order.payment.payment_status === 'paid_simulated' ? 'Paid (Simulated)' : 'Pending'}` : ''}
                                                </p>

                                                <div>
                                                    {order.items?.map((item, index) => (
                                                        <p key={`${item.item_name}-${index}`}>
                                                            {item.item_name}
                                                            {' × '}
                                                            {item.quantity}
                                                            {' — ₹'}
                                                            {(
                                                                item.price *
                                                                item.quantity
                                                            ).toFixed(2)}
                                                        </p>
                                                    ))}
                                                </div>

                                                <strong>
                                                    Total: ₹
                                                    {Number(order.total_amount).toFixed(2)}
                                                </strong>
                                            </div>

                                            <Link
                                                to={`/orders/${order.order_number}`}
                                                className="back-link"
                                            >
                                                View details →
                                            </Link>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </main>
    )
}

export default MyOrders
