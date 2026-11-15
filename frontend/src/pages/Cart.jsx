
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import '../App.css'

function Cart() {
  const {
    cartItems,
    addToCart,
    decreaseQuantity,
    removeFromCart,
    clearCart,
    totalItems,
    totalPrice,
  } = useCart()

  if (cartItems.length === 0) {
    return (
      <main className="cart-page">
        <div className="empty-cart">
          <div className="empty-cart-icon">🛒</div>
          <h1>Your cart is empty</h1>
          <p>Looks like you haven't added anything yet.</p>
          <Link to="/" className="checkout-button">
            Explore restaurants
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="cart-page">
      <div className="cart-container">

        <div className="cart-header">
          <div>
            <p className="section-eyebrow">YOUR ORDER</p>
            <h1>Your Cart</h1>
            <p>{totalItems} items in your cart</p>
          </div>

          <div className="cart-header-actions">
          <Link to="/" className="continue-shopping">
         + Add more food
         </Link>

         <button 
         type="button" className="remove-item" 
         onClick={clearCart}> 
         Clear Cart </button>
</div>
        </div>

        <div className="cart-layout">

          <section className="cart-items">

            {cartItems.map((item) => (
              <article
                className="cart-item"
                key={`${item.restaurantId}-${item.id}`}
              >
                <div className="cart-item-image">
                  {item.emoji || '🍽️'}
                </div>

                <div className="cart-item-details">
                  <h3>{item.name}</h3>
                  <p>{item.restaurantName}</p>
                  <strong>₹{item.price}</strong>
                </div>

                <div className="cart-item-actions">
                  <div className="quantity-control">

                    <button
                      onClick={() =>
                        decreaseQuantity(
                          item.id,
                          item.restaurantId
                        )
                      }
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() =>
                        addToCart(item, {
                          id: item.restaurantId,
                          name: item.restaurantName,
                        })
                      }
                    >
                      +
                    </button>

                  </div>

                  <button
                    className="remove-item"
                    onClick={() =>
                      removeFromCart(
                        item.id,
                        item.restaurantId
                      )
                    }
                  >
                    Remove
                  </button>
                </div>

              </article>
            ))}

          </section>

          <aside className="cart-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Item total</span>
              <span>₹{totalPrice}</span>
            </div>

            <div className="summary-row">
              <span>Delivery fee</span>
              <span>Calculated at checkout</span>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row summary-total">
              <strong>Total</strong>
              <strong>₹{totalPrice}</strong>
            </div>

            
            <Link to="/checkout" className="checkout-button">
             Proceed to Checkout
             </Link>

            <p className="cart-note">
              Delivery charges may apply.
            </p>
          </aside>

        </div>
      </div>
    </main>
  )
}

export default Cart
