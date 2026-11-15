
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() =>
        localStorage.getItem('campusbite_token')
    )

    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('campusbite_user')

        try {
            return savedUser ? JSON.parse(savedUser) : null
        } catch {
            return null
        }
    })

    function login(accessToken, userData) {
        localStorage.setItem('campusbite_token', accessToken)
        localStorage.setItem('campusbite_user', JSON.stringify(userData))

        setToken(accessToken)
        setUser(userData)
    }

    function logout() {
        localStorage.removeItem('campusbite_token')
        localStorage.removeItem('campusbite_user')

        setToken(null)
        setUser(null)
    }

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                isLoggedIn: Boolean(token),
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error(
            'useAuth must be used inside an AuthProvider'
        )
    }

    return context
}
