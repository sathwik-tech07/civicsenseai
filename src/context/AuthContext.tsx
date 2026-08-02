import React, { createContext, useContext, useState } from 'react';

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

function getDepartmentForRole(role: UserRole): string {
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
  loginUser: (fullName: string, email: string, role: UserRole) => AuthUser;
  login: (email: string, password?: string) => Promise<AuthUser>;
  signup: (fullName: string, email: string, password?: string, role?: UserRole, department?: string) => Promise<AuthUser>;
  loginAsDemo: (role?: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('activeUser') || localStorage.getItem('civicsense_auth_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) {
          const fullName = parsed.fullName || parsed.name || parsed.full_name || '';
          const email = parsed.email || parsed.mail || '';
          const role: UserRole = parsed.role || parsed.userRole || 'commissioner';
          if (email && role) {
            return {
              id: parsed.id || `usr-${Date.now()}`,
              fullName: fullName || email.split('@')[0].replace(/[._]/g, ' '),
              email,
              role,
              department: getDepartmentForRole(role),
            } as AuthUser;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse localStorage user:', e);
    }
    return null;
  });

  const isLoading = false;

  const loginUser = (fullName: string, email: string, role: UserRole): AuthUser => {
    const cleanName = fullName.trim() || '';
    const cleanEmail = email.trim() || '';

    const storagePayload = { name: cleanName || (cleanEmail ? cleanEmail.split('@')[0].replace(/[._]/g, ' ') : ''), email: cleanEmail, role };
    try {
      localStorage.setItem('activeUser', JSON.stringify(storagePayload));
    } catch (e) {
      console.warn('Failed to write activeUser to localStorage', e);
    }

    const activeUser: AuthUser = {
      id: `usr-${Date.now()}`,
      fullName: storagePayload.name || (cleanEmail ? cleanEmail.split('@')[0].replace(/[._]/g, ' ') : 'Civic User'),
      email: storagePayload.email || `${role}@civicsense.ai`,
      role,
      department: getDepartmentForRole(role),
    } as AuthUser;

    setUser(activeUser);
    return activeUser;
  };

  const login = async (email: string, _password?: string): Promise<AuthUser> => {
    const lower = email.toLowerCase();
    let matchedRole: UserRole = 'commissioner';
    if (lower.includes('engineer')) matchedRole = 'engineer';
    else if (lower.includes('citizen')) matchedRole = 'citizen';
    else if (lower.includes('admin')) matchedRole = 'admin';

    const name = email.split('@')[0]?.replace(/[._]/g, ' ') || 'Civic User';
    return loginUser(name, email, matchedRole);
  };

  const signup = async (fullName: string, email: string, _password?: string, role: UserRole = 'citizen', _department?: string): Promise<AuthUser> => {
    return loginUser(fullName, email, role);
  };

  const loginAsDemo = async (role: UserRole = 'commissioner') => {
    const demoProfiles: Record<UserRole, { name: string; email: string }> = {
      commissioner: { name: 'Dr. Anita Roy', email: 'commissioner@civicsense.ai' },
      engineer: { name: 'Eng. Rajesh V', email: 'engineer@civicsense.ai' },
      citizen: { name: 'Priya Sharma', email: 'citizen@civicsense.ai' },
      admin: { name: 'System Administrator', email: 'admin@civicsense.ai' },
    };
    const p = demoProfiles[role] || demoProfiles.commissioner;
    loginUser(p.name, p.email, role);
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('activeUser');
      // also remove legacy key if present
      localStorage.removeItem('civicsense_auth_user');
      localStorage.removeItem('civicsense_jwt');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Failed to clear local/session storage during logout', e);
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
