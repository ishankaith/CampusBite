
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getRestaurants } from '../services/api'
import '../App.css'
import { useLocation } from 'react-router-dom'

// Individual restaurant card component
function RestaurantCard({ restaurant }) {
  // Convert backend data into the format used by our design
  const colors = {
    'Indian Kitchen': 'sand',
    'Campus Pizza': 'sage',
    'Burger Point': 'peach',
    'Green Bowl': 'mint',
  }

  const emojis = {
    'Indian Kitchen': '🍛',
    'Campus Pizza': '🍕',
    'Burger Point': '🍔',
    'Green Bowl': '🥗',
  }

  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className="restaurant-card-link"
    >
      <article className="restaurant-card">
        <div className={`restaurant-image ${colors[restaurant.name] || 'sand'}`}>
          <span className="food-emoji">
            {emojis[restaurant.name] || restaurant.image || '🍽️'}
          </span>
          <span className="rating">★ {restaurant.rating}</span>
        </div>

        <div className="restaurant-info">
          <div className="restaurant-heading">
            <h3>{restaurant.name}</h3>
            <span className="delivery-time">
              {restaurant.delivery_time}
            </span>
          </div>

          <p className="cuisine">{restaurant.cuisine}</p>
          <p className="price">
            ₹{restaurant.price_for_one} for one
          </p>
        </div>
      </article>
    </Link>
  )
}


// Main application component
function Home() {
  const [restaurants, setRestaurants] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] =
    useState('All restaurants')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const location = useLocation()

useEffect(() => {
  const hash = location.hash

  if (!hash) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  const sectionId = hash.substring(1)

  requestAnimationFrame(() => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  })
}, [location.pathname, location.hash])

  // Fetch restaurants from FastAPI
  useEffect(() => {
    async function fetchRestaurants() {
      try {
        setLoading(true)
        const data = await getRestaurants()
        setRestaurants(data)
        setError('')
      } catch (err) {
        console.error('Restaurant fetching error:', err)
        setError('Unable to load restaurants. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurants()
  }, [])

  // Search and category filtering
  const filteredRestaurants = restaurants.filter((restaurant) => {
    const searchText = searchQuery.toLowerCase()

    const matchesSearch =
      restaurant.name.toLowerCase().includes(searchText) ||
      restaurant.cuisine.toLowerCase().includes(searchText)

    const matchesCategory =
      selectedCategory === 'All restaurants' ||
      (selectedCategory === 'North Indian' &&
        restaurant.cuisine.toLowerCase().includes('north indian')) ||
      (selectedCategory === 'Fast food' &&
        restaurant.cuisine.toLowerCase().includes('fast food')) ||
      (selectedCategory === 'Pizza' &&
        restaurant.cuisine.toLowerCase().includes('pizza')) ||
      (selectedCategory === 'Healthy' &&
        restaurant.cuisine.toLowerCase().includes('healthy'))

    return matchesSearch && matchesCategory
  })

  return (
    <>

{location.state?.message && (
  <div style={{
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '12px',
    margin: '15px',
    borderRadius: '6px',
    textAlign: 'center'
  }}>
    {location.state.message}
  </div>
)}

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <span className="eyebrow">
              GOOD FOOD. RIGHT AROUND YOU.
            </span>

            <h1>
              Your campus.
              <br />
              Your cravings.
              <br />
              <span>Our delivery.</span>
            </h1>

            <p>
              Discover amazing food around your campus.
              Order your favourites and get them delivered
              without the hassle.
            </p>

            <div className="search-box">
              <span aria-hidden="true">⌕</span>

              <input
                type="text"
                placeholder="Search restaurants or cuisines..."
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
              />

              <span className="search-label">SEARCH</span>
            </div>

            <div className="hero-note">
              <span>✓</span> Easy ordering
              <span>✓</span> Campus-focused
              <span>✓</span> Made for you
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-circle">
              <span>🍜</span>
            </div>
            <div className="floating-card">
              <span>✦</span>
              <div>
                <strong>Something delicious</strong>
                <small>Just around the corner</small>
              </div>
            </div>
            <div className="hero-decoration">✳</div>
          </div>
        </section>

        <section className="restaurants-section" id="restaurants">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE FOOD SCENE</span>
              <h2>Find your next favourite.</h2>
              <p>Good places. Great food. All near campus.</p>
            </div>

            <span className="restaurant-count">
              {filteredRestaurants.length} restaurants
            </span>
          </div>

          <div className="category-list">
            {[
              'All restaurants',
              'North Indian',
              'Fast food',
              'Pizza',
              'Healthy',
            ].map((category) => (
              <button
                key={category}
                type="button"
                className={
                  selectedCategory === category
                    ? 'category active'
                    : 'category'
                }
                onClick={() => setSelectedCategory(category)}
                aria-pressed={selectedCategory === category}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="restaurant-grid">
            {loading ? (
              <p>Loading restaurants...</p>
            ) : error ? (
              <p className="no-results">{error}</p>
            ) : filteredRestaurants.length > 0 ? (
              filteredRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                />
              ))
            ) : (
              <p className="no-results">
                No restaurants found. Try another search.
              </p>
            )}
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <span className="eyebrow">SIMPLE AS IT SHOULD BE</span>
          <h2>Food in three easy steps.</h2>

          <div className="steps-grid">
            <div className="step">
              <span>01</span>
              <h3>Discover</h3>
              <p>Explore restaurants and menus around your campus.</p>
            </div>

            <div className="step">
              <span>02</span>
              <h3>Order</h3>
              <p>Choose your favourites and place your order.</p>
            </div>

            <div className="step">
              <span>03</span>
              <h3>Enjoy</h3>
              <p>Get your food delivered and enjoy your meal.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-icon">C</span>
          <span>CampusBite</span>
        </a>
        <p>Made for campus life. Built for food lovers.</p>
      </footer>
    </>
  )
}

export default Home
