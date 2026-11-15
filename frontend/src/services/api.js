const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// Get authentication headers for protected backend endpoints.
function getAuthHeaders() {
    const token = localStorage.getItem("campusbite_token");
    if (!token) throw new Error("Please log in to continue");
    return { Authorization: `Bearer ${token}` };
}

async function getErrorMessage(response, fallback) {
    try {
        const data = await response.json();
        return data.detail || data.message || fallback;
    } catch {
        return fallback;
    }
}

// Get all restaurants.
export async function getRestaurants() {
    const response = await fetch(`${API_URL}/restaurants/`);
    if (!response.ok) throw new Error("Unable to fetch restaurants");
    return response.json();
}

// Get one restaurant.
export async function getRestaurant(id) {
    const response = await fetch(`${API_URL}/restaurants/${id}`);
    if (!response.ok) throw new Error("Unable to fetch restaurant");
    return response.json();
}

// Get restaurant menu.
export async function getRestaurantMenu(id) {
    const response = await fetch(`${API_URL}/restaurants/${id}/menu`);
    if (!response.ok) throw new Error("Unable to fetch restaurant menu");
    return response.json();
}

// Create a new order.
export async function createOrder(orderData) {
    const response = await fetch(`${API_URL}/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(orderData),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to place order"));
    return response.json();
}

// Get order details.
export async function getOrder(orderNumber) {
    const response = await fetch(`${API_URL}/orders/${encodeURIComponent(orderNumber)}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to retrieve order details"));
    return response.json();
}

// Get orders belonging to the logged-in customer.
export async function getMyOrders() {
    const response = await fetch(`${API_URL}/orders/my-orders`, {
        method: "GET",
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to retrieve your orders"));
    return response.json();
}

// Check Gemini configuration. This endpoint still requires customer authentication.
export async function getAIHealth() {
    const response = await fetch(`${API_URL}/ai/health`, {
        method: "GET",
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to check AI service status"));
    return response.json();
}

// Generate a summary from the authenticated customer's own orders.
export async function getAIOrderSummary() {
    const response = await fetch(`${API_URL}/ai/orders/summary`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to generate your order summary"));
    return response.json();
}

// Ask a question about the authenticated customer's own order history.
export async function askAIAboutOrders(question) {
    const response = await fetch(`${API_URL}/ai/orders/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ question }),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to answer your question"));
    return response.json();
}
