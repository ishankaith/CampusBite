import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { askAIAboutOrders, getAIHealth, getAIOrderSummary } from '../services/api'
import '../App.css'

function AIAssistant() {
    const { isLoggedIn, user } = useAuth()
    const navigate = useNavigate()
    const [health, setHealth] = useState(null)
    const [summary, setSummary] = useState('')
    const [question, setQuestion] = useState('')
    const [answer, setAnswer] = useState('')
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [askLoading, setAskLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/login', { replace: true })
            return
        }
        if (user?.role !== 'customer') {
            navigate('/', { replace: true })
            return
        }
        getAIHealth().then(setHealth).catch((err) => setError(err.message))
    }, [isLoggedIn, user, navigate])

    async function handleSummary() {
        setSummaryLoading(true)
        setError('')
        setSummary('')
        try {
            const result = await getAIOrderSummary()
            setSummary(result.summary)
        } catch (err) {
            setError(err.message || 'Unable to generate your summary.')
        } finally {
            setSummaryLoading(false)
        }
    }

    async function handleAsk(event) {
        event.preventDefault()
        if (question.trim().length < 3) {
            setError('Please enter a question of at least 3 characters.')
            return
        }
        setAskLoading(true)
        setError('')
        setAnswer('')
        try {
            const result = await askAIAboutOrders(question.trim())
            setAnswer(result.answer)
        } catch (err) {
            setError(err.message || 'Unable to answer your question.')
        } finally {
            setAskLoading(false)
        }
    }

    if (!isLoggedIn || user?.role !== 'customer') return null

    return (
        <main className="checkout-page">
            <div className="checkout-container campusbite-ai-page">
                <div className="checkout-heading">
                    <span className="eyebrow">CAMPUSBITE INTELLIGENCE</span>
                    <h1>Your AI Order Assistant</h1>
                    <p>Explore your own CampusBite order history with help from Google Gemini.</p>
                </div>

                <section className="checkout-section campusbite-ai-notice">
                    <strong>Private to your account</strong>
                    <p>The backend verifies your login and retrieves only your orders before sending limited order details to Gemini. Never share passwords or payment credentials here.</p>
                    {health && (
                        <p className={health.configured ? 'campusbite-ai-ready' : 'campusbite-ai-unready'}>
                            Gemini status: {health.configured ? `Connected (${health.model})` : health.message}
                        </p>
                    )}
                </section>

                {error && <div className="checkout-error" role="alert">{error}</div>}

                <section className="checkout-section">
                    <h2>Summarise my order history</h2>
                    <p>Get a summary of your orders, spending and frequently ordered dishes.</p>
                    <button type="button" className="checkout-button" onClick={handleSummary} disabled={summaryLoading}>
                        {summaryLoading ? 'Analysing your orders...' : 'Generate my summary'}
                    </button>
                    {summary && <div className="campusbite-ai-response" aria-live="polite"><h3>Your order-history summary</h3><p>{summary}</p></div>}
                </section>

                <section className="checkout-section">
                    <h2>Ask a question</h2>
                    <p>Try questions such as “Which dish have I ordered most often?” or “How much have I spent on CampusBite?”</p>
                    <form onSubmit={handleAsk}>
                        <label htmlFor="campusbite-ai-question">Your question</label>
                        <textarea id="campusbite-ai-question" rows="3" maxLength="500" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask something about your previous orders..." />
                        <button type="submit" className="checkout-button" disabled={askLoading || question.trim().length < 3}>
                            {askLoading ? 'Thinking...' : 'Ask Gemini'}
                        </button>
                    </form>
                    {answer && <div className="campusbite-ai-response" aria-live="polite"><h3>Assistant's answer</h3><p>{answer}</p></div>}
                </section>

                <p><Link to="/orders" className="back-link">← Back to My Orders</Link></p>
            </div>
        </main>
    )
}

export default AIAssistant
