
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { createOrder } from '../services/api'
import '../App.css'

function Checkout() {
  const { cartItems, totalPrice, clearCart } = useCart()

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    address: '',
  })

  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [paymentDetails, setPaymentDetails] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target

    setCustomer((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (cartItems.length === 0 || isSubmitting) {
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      const orderData = {
        customer_name: customer.name,
        phone: customer.phone,
        address: customer.address,
        payment_method: paymentMethod,
        items: cartItems.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
        })),
      }

      const result = await createOrder(orderData)

      const newOrderNumber = `CB${String(result.id).padStart(6, '0')}`

      setOrderNumber(newOrderNumber)
      setPaymentDetails(result.payment || null)

      // Clear the cart only after the backend confirms the order.
      clearCart()
      setOrderPlaced(true)
    } catch (err) {
      console.error('Order placement failed:', err)
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (orderPlaced) {
    return (
      <main className="checkout-page">
        <div className="order-success">
          <div className="success-icon">✓</div>

          <span className="eyebrow">ORDER CONFIRMED</span>

          <h1>Thank you for your order!</h1>

          <p>
            Your CampusBite order has been saved successfully.
          </p>

          <div className="order-number">
            <span>Order number</span>
            <strong>{orderNumber}</strong>
          </div>

          <section className="checkout-summary" aria-label="Payment details">
            <h2>Payment details</h2>
            <div className="summary-row">
              <span>Payment method</span>
              <strong>{paymentDetails?.payment_method === 'cod' ? 'Cash on Delivery' : 'Dummy Online Payment'}</strong>
            </div>
            <div className="summary-row">
              <span>Payment status</span>
              <strong>{paymentDetails?.payment_status === 'paid_simulated' ? 'Paid (Simulated)' : paymentDetails?.payment_status === 'pending' ? 'Pending' : 'Not available'}</strong>
            </div>
            {paymentDetails?.transaction_reference && (
              <div className="summary-row">
                <span>Transaction reference</span>
                <strong>{paymentDetails.transaction_reference}</strong>
              </div>
            )}
          </section>

          <Link to="/orders" className="back-link">View my orders →</Link>
          <Link to="/" className="checkout-button">
            Back to homepage
          </Link>
        </div>
      </main>
    )
  }

  if (cartItems.length === 0) {
    return (
      <main className="checkout-page">
        <div className="empty-cart">
          <h1>Your cart is empty</h1>
          <Link to="/" className="checkout-button">
            Explore restaurants
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="checkout-page">
      <div className="checkout-container">

        <div className="checkout-heading">
          <span className="eyebrow">FINAL STEP</span>
          <h1>Checkout</h1>
          <p>Complete your details to place your order.</p>
        </div>

        <div className="checkout-layout">

          <form
            className="checkout-form"
            onSubmit={handleSubmit}
          >
            <section className="checkout-section">
              <h2>Delivery information</h2>

              <label htmlFor="name">Full name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={customer.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
              />

              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={customer.phone}
                onChange={handleChange}
                placeholder="Enter your phone number"
                pattern="[0-9]{10}"
                title="Enter a 10-digit phone number"
                required
              />

              <label htmlFor="address">Delivery address</label>
              <textarea
                id="address"
                name="address"
                value={customer.address}
                onChange={handleChange}
                placeholder="House number, street, locality..."
                rows="4"
                required
              />
            </section>

            <section className="checkout-section">
              <h2>Payment method</h2>

              <label className="payment-option">
                <input
                  type="radio"
                  name="payment"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                />
                Cash on Delivery
              </label>

              <label className="payment-option">
                <input
                  type="radio"
                  name="payment"
                  value="online"
                  checked={paymentMethod === 'online'}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                />
                Dummy Online Payment
              </label>

              <p className="cart-note">
                Online payment is simulated for this project.
                No real payment will be processed.
              </p>
            </section>

            {error && (
              <p role="alert" className="checkout-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="checkout-button"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Placing order...'
                : `Place Order · ₹${totalPrice}`}
            </button>

          </form>

          <aside className="checkout-summary">
            <h2>Order summary</h2>

            {cartItems.map((item) => (
              <div
                className="summary-row"
                key={`${item.restaurantId}-${item.id}`}
              >
                <span>
                  {item.name} × {item.quantity}
                </span>

                <strong>
                  ₹{item.price * item.quantity}
                </strong>
              </div>
            ))}

            <div className="summary-divider"></div>

            <div className="summary-row summary-total">
              <strong>Total</strong>
              <strong>₹{totalPrice}</strong>
            </div>

            <Link to="/cart" className="continue-shopping">
              ← Return to cart
            </Link>
          </aside>

        </div>
      </div>
    </main>
  )
}

export default Checkout
