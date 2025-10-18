'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  tenantId: string
}

interface Tenant {
  id: string
  name: string
  slug: string
}

interface AuthContextType {
  user: User | null
  tenant: Tenant | null
  isAuthenticated: boolean
  isLoading: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PUBLIC_ROUTES = ['/login', '/register']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Load auth state from localStorage
    const loadAuthState = () => {
      try {
        const token = localStorage.getItem('token')
        const userStr = localStorage.getItem('user')
        const tenantStr = localStorage.getItem('tenant')

        if (token && userStr && tenantStr) {
          setUser(JSON.parse(userStr))
          setTenant(JSON.parse(tenantStr))
        } else if (!PUBLIC_ROUTES.includes(pathname)) {
          // No auth and trying to access protected route
          router.push('/login')
        }
      } catch (error) {
        console.error('Failed to load auth state:', error)
        localStorage.clear()
        if (!PUBLIC_ROUTES.includes(pathname)) {
          router.push('/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadAuthState()
  }, [pathname, router])

  const logout = () => {
    localStorage.clear()
    setUser(null)
    setTenant(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
