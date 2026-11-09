import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  apiLogin,
  apiSignup,
  apiGetMe,
  getStoredToken,
  setStoredToken,
  onUnauthorized,
} from '../services/apiClient';

export type UserRole = 'citizen' | 'engineer' | 'commissioner' | 'admin';

export interface AuthUser {
  id?: string;
  email: string;
  fullName: string;
  role: UserRole;
  token?: string;
  department?: string;
  createdAt?: string;
  avatarInitials?: string;
}

export function getAvatarInitials(name: string): string {
  if (!name) return 'CS';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getDepartmentForRole(role: UserRole): string {
  switch (role) {
    case 'commissioner':
      return 'Executive Command & Municipal Administration';
    case 'engineer':
      return 'Roads & Infrastructure Engineering';
    case 'citizen':
      return 'Public Relations & Community Portal';
    case 'admin':
      return 'IT Operations & System Infrastructure';
    default:
      return 'Municipal Operations';
  }
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginUser: (fullName: string, email: string, role: UserRole, password?: string) => Promise<AuthUser>;
  login: (email: string, password?: string) => Promise<AuthUser>;
  signup: (fullName: string, email: string, password?: string, role?: UserRole, department?: string) => Promise<AuthUser>;
  loginAsDemo: (role?: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Session verification on mount / page refresh
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        logout();
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const profile = await apiGetMe(storedToken);
        if (isMounted && profile && profile.id) {
          const validatedUser: AuthUser = {
            id: profile.id,
            email: profile.email,
            fullName: profile.full_name,
            role: profile.role as UserRole,
            department: profile.department || getDepartmentForRole(profile.role as UserRole),
            token: storedToken,
            createdAt: profile.created_at,
          };
          setUser(validatedUser);
          try {
            localStorage.setItem(
              'activeUser',
              JSON.stringify({
                id: validatedUser.id,
                name: validatedUser.fullName,
                email: validatedUser.email,
                role: validatedUser.role,
              })
            );
          } catch (e) {
            console.warn('Failed to persist activeUser to localStorage', e);
          }
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Session verification failed on startup / refresh:', err);
        logout();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    verifySession();

    // Subscribe to centralized 401 unauthorized notifications
    const unsubscribe = onUnauthorized(() => {
      if (isMounted) {
        logout();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password?: string): Promise<AuthUser> => {
    const cleanEmail = email.trim();
    const cleanPassword = (password ?? '').trim();
    if (!cleanPassword && !import.meta.env.DEV) {
      throw new Error('Password is required.');
    }
    const finalPassword = cleanPassword || (import.meta.env.DEV ? 'password123' : '');
    const data = await apiLogin(cleanEmail, finalPassword);
    const backendUser = data.user;
    const token = data.access_token;

    setStoredToken(token);

    const authUser: AuthUser = {
      id: backendUser.id,
      email: backendUser.email,
      fullName: backendUser.full_name,
      role: backendUser.role as UserRole,
      department: backendUser.department || getDepartmentForRole(backendUser.role as UserRole),
      token,
      createdAt: backendUser.created_at,
    };

    try {
      localStorage.setItem(
        'activeUser',
        JSON.stringify({
          id: authUser.id,
          name: authUser.fullName,
          email: authUser.email,
          role: authUser.role,
        })
      );
    } catch (e) {
      console.warn('Failed to write activeUser to localStorage', e);
    }

    setUser(authUser);
    return authUser;
  };

  const signup = async (
    fullName: string,
    email: string,
    password?: string,
    role: UserRole = 'citizen',
    _department?: string
  ): Promise<AuthUser> => {
    const cleanPassword = (password ?? '').trim();
    if (!cleanPassword && !import.meta.env.DEV) {
      throw new Error('Password is required.');
    }
    const finalPassword = cleanPassword || (import.meta.env.DEV ? 'password123' : '');
    await apiSignup(fullName.trim(), email.trim(), finalPassword, role);
    return await login(email, finalPassword);
  };

  const loginUser = async (
    fullName: string,
    email: string,
    role: UserRole,
    password?: string
  ): Promise<AuthUser> => {
    const cleanPassword = (password ?? '').trim();
    if (!cleanPassword && !import.meta.env.DEV) {
      throw new Error('Password is required.');
    }
    const pwd = cleanPassword || (import.meta.env.DEV ? 'password123' : '');
    try {
      return await login(email, pwd);
    } catch (err: any) {
      // In development, auto-signup helper if user does not exist in local dev DB
      if (import.meta.env.DEV) {
        try {
          await apiSignup(fullName, email, pwd, role);
          return await login(email, pwd);
        } catch (signupErr) {
          throw err;
        }
      }
      throw err;
    }
  };

  const loginAsDemo = async (role: UserRole = 'commissioner') => {
    if (import.meta.env.DEV) {
      const demoProfiles: Record<UserRole, { name: string; email: string }> = {
        commissioner: { name: 'Dr. Anita Roy', email: 'commissioner@civicsense.ai' },
        engineer: { name: 'Eng. Rajesh V', email: 'engineer@civicsense.ai' },
        citizen: { name: 'Priya Sharma', email: 'citizen@civicsense.ai' },
        admin: { name: 'System Administrator', email: 'admin@civicsense.ai' },
      };
      const p = demoProfiles[role] || demoProfiles.commissioner;
      await login(p.email, 'password123');
    } else {
      throw new Error('Demo accounts are disabled in production mode.');
    }
  };

  const logout = () => {
    setUser(null);
    setStoredToken(null);
    try {
      localStorage.removeItem('activeUser');
      localStorage.removeItem('civicsense_auth_user');
      localStorage.removeItem('civicsense_jwt');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Failed to clear storage during logout', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginUser,
        login,
        signup,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
