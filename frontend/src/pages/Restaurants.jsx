
import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { useCart } from '../context/CartContext'
import { getRestaurant, getRestaurantMenu } from '../services/api'

function getFoodEmoji(name) {
  const food = name.toLowerCase()

  if (food.includes('pizza')) return '🍕'
  if (food.includes('burger')) return '🍔'
  if (food.includes('fries')) return '🍟'
  if (food.includes('paneer')) return '🍛'
  if (food.includes('dal')) return '🥘'
  if (food.includes('biryani')) return '🍚'
  if (food.includes('salad')) return '🥗'
  if (food.includes('protein')) return '🥙'
  if (food.includes('fruit')) return '🍓'
  if (food.includes('bread')) return '🥖'

  return '🍽️'
}

function getRestaurantEmoji(name) {
  const restaurant = name.toLowerCase()

  if (restaurant.includes('indian')) return '🍛'
  if (restaurant.includes('pizza')) return '🍕'
  if (restaurant.includes('burger')) return '🍔'
  if (restaurant.includes('green')) return '🥗'

  return '🍽️'
}

function getRestaurantColor(name) {
  const restaurant = name.toLowerCase()

  if (restaurant.includes('indian')) return 'sand'
  if (restaurant.includes('pizza')) return 'sage'
  if (restaurant.includes('burger')) return 'peach'
  if (restaurant.includes('green')) return 'mint'

  return 'sand'
}

function Restaurant() {
  const { id } = useParams()
  const { addToCart } = useCart()

  const [restaurant, setRestaurant] = useState(null)
  const [menu, setMenu] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchRestaurantData() {
      try {
        setLoading(true)
        setError('')

        const [restaurantData, menuData, reviewData] = await Promise.all([
          getRestaurant(id),
          getRestaurantMenu(id),
          fetch(`http://127.0.0.1:8000/restaurants/${id}/reviews`).then(response => {
            if (!response.ok) throw new Error('Unable to load restaurant reviews')
            return response.json()
          }),
        ])

        setRestaurant(restaurantData)
        setMenu(menuData)
        setReviews(Array.isArray(reviewData) ? reviewData : [])
      } catch (err) {
        console.error('Error fetching restaurant:', err)
        setError('Unable to load this restaurant. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurantData()
  }, [id])

  if (loading) {
    return (
      <main className="restaurant-page">
        <p>Loading restaurant...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="restaurant-page">
        <h1>Something went wrong</h1>
        <p>{error}</p>
        <Link to="/">Return to homepage</Link>
      </main>
    )
  }

  if (!restaurant) {
    return (
      <main className="restaurant-page">
        <h1>Restaurant not found</h1>
        <Link to="/">Return to homepage</Link>
      </main>
    )
  }

  const restaurantInfo = {
    id: restaurant.id,
    name: restaurant.name,
  }

  return (
    <main className="restaurant-page">
      <Link to="/" className="back-link">
        ← Back to restaurants
      </Link>

      <section className="restaurant-banner">
        <div className={`restaurant-banner-image ${getRestaurantColor(restaurant.name)}`}>
          <span>{getRestaurantEmoji(restaurant.name)}</span>
        </div>

        <div className="restaurant-banner-info">
          <span className="eyebrow">RESTAURANT DETAILS</span>
          <h1>{restaurant.name}</h1>
          <p>
            Enjoy delicious {restaurant.cuisine || 'freshly prepared'} meals
            made with fresh ingredients.
          </p>

          <div className="restaurant-meta">
            <span>★ {restaurant.rating}</span>
            <span>{restaurant.cuisine}</span>
            <span>{restaurant.delivery_time}</span>
          </div>
        </div>
      </section>

      <section className="menu-section" style={{ marginTop: 28 }}>
        <span className="eyebrow">CUSTOMER FEEDBACK</span>
        <h2>Customer reviews</h2>
        <p className="menu-subtitle">{reviews.length} review{reviews.length === 1 ? '' : 's'} · Average rating: {Number(restaurant.rating || 0).toFixed(1)} / 5</p>
        {reviews.length ? (
          <div className="menu-list">
            {reviews.map(review => (
              <article className="menu-item" key={review.id}>
                <div className="menu-item-info">
                  <h3>{review.customer_name} <span style={{ color: '#d69e2e' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></h3>
                  <p>{review.comment}</p>
                  {Array.isArray(review.ordered_items) && review.ordered_items.length > 0 && (
                    <p className="review-ordered-items">
                      <strong>Ordered:</strong> {review.ordered_items.map(item => `${item.item_name} × ${item.quantity}`).join(', ')}
                    </p>
                  )}
                  <small>{review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN') : ''}</small>
                </div>
              </article>
            ))}
          </div>
        ) : <p>No customer reviews yet. Be the first to share your experience after ordering.</p>}
      </section>

      <section className="menu-section">
        <span className="eyebrow">EXPLORE THE MENU</span>
        <h2>What are you craving?</h2>
        <p className="menu-subtitle">
          Freshly prepared favourites, just for you.
        </p>

        <div className="menu-list">
          {menu.length > 0 ? (
            menu.map((item) => (
              <article className="menu-item" key={item.id}>
                <div className="menu-item-emoji">
                  {getFoodEmoji(item.name)}
                </div>

                <div className="menu-item-info">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <strong>₹{item.price}</strong>
                </div>

                <button
                  type="button"
                  className="add-button"
                  onClick={() => addToCart(
                    { ...item, emoji: getFoodEmoji(item.name) },
                    restaurantInfo
                  )}
                >
                  ADD +
                </button>
              </article>
            ))
          ) : (
            <p>No menu items are available at this restaurant yet.</p>
          )}
        </div>
      </section>
    </main>
  )
}

export default Restaurant
