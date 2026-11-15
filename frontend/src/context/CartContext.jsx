
import { createContext, useContext, useState, useEffect } from 'react'

// Create a shared cart context
const CartContext = createContext()

// Make cart information available to the application
export function CartProvider({ children }) {

  // Load previously saved cart items from localStorage
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem('campusbite-cart')
      return savedCart ? JSON.parse(savedCart) : []
    } catch (error) {
      console.error('Could not load cart:', error)
      return []
    }
  })

  // Save cart items whenever they change
  useEffect(() => {
    localStorage.setItem(
      'campusbite-cart',
      JSON.stringify(cartItems)
    )
  }, [cartItems])

  // Add an item to the cart
  function addToCart(item, restaurant) {
    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (cartItem) =>
          cartItem.id === item.id &&
          cartItem.restaurantId === restaurant.id
      )

      if (existingItem) {
        return currentItems.map((cartItem) =>
          cartItem.id === item.id &&
          cartItem.restaurantId === restaurant.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      }

      return [
        ...currentItems,
        {
          ...item,
          quantity: 1,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
        },
      ]
    })
  }

  // Remove one item or decrease its quantity
  function decreaseQuantity(itemId, restaurantId) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === itemId &&
          item.restaurantId === restaurantId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  // Remove an item completely
  function removeFromCart(itemId, restaurantId) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) =>
          !(item.id === itemId &&
            item.restaurantId === restaurantId)
      )
    )
  }
  // Clear the entire cart after successful order placement
 function clearCart() {
  setCartItems([])
 }

  // Calculate total number of items
  const totalItems = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  )

  // Calculate total price
  const totalPrice = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )

  const cartValue = {
    cartItems,
    addToCart,
    decreaseQuantity,
    removeFromCart,
    clearCart, 
    totalItems,
    totalPrice,
  }

  return (
    <CartContext.Provider value={cartValue}>
      {children}
    </CartContext.Provider>
  )
}

// Allow components to access the cart
export function useCart() {
  return useContext(CartContext)
}
