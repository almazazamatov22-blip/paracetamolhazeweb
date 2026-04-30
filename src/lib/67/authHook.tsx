'use client';

import { useState, useEffect, createContext, useContext } from 'react';

interface User {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setUser({
            id: data.id,
            login: data.login,
            display_name: data.display_name,
            profile_image_url: data.profile_image_url
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const signOut = () => {
    window.location.href = '/api/auth/logout?source=67';
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const signIn = (source: string = '67') => {
  window.location.href = `/auth/twitch?source=${source}`;
};

export const signOut = (source: string = '67') => {
  window.location.href = `/api/auth/logout?source=${encodeURIComponent(source)}`;
};

// Backwards compatibility shim for useSession-like usage
export const useSession = () => {
  const { user, loading } = useAuth();
  return { 
    data: user ? { user: { name: user.display_name, image: user.profile_image_url, id: user.id } } : null,
    status: loading ? 'loading' : user ? 'authenticated' : 'unauthenticated'
  };
};
