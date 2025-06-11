import React, { createContext, useContext, useState } from 'react';

type UserRole = 'user' | 'admin' | null;

interface AuthContextType {
  role: UserRole;
  login: (username: string, password: string) => Promise<boolean>;
  loginAsUser: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<UserRole>(null);

  const login = async (username: string, password: string): Promise<boolean> => {
    if (username === 'nano' && password === '1214967a') {
      setRole('admin');
      return true;
    }
    return false;
  };

  const loginAsUser = () => {
    setRole('user');
  };

  const logout = () => {
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ role, login, loginAsUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};