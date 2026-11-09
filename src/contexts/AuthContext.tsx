import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  photoURL: string | null;
  updatePhotoURL: (photo: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser?.uid) {
        try {
          const cached = localStorage.getItem(`abp_user_photo_${firebaseUser.uid}`);
          setPhotoURL(cached || firebaseUser.photoURL || null);
        } catch {
          setPhotoURL(firebaseUser.photoURL || null);
        }
      } else {
        setPhotoURL(null);
      }
      console.log(
        '[Auth]',
        firebaseUser ? `Signed in as ${firebaseUser.email}` : 'Not signed in',
      );
    });
    return unsubscribe;
  }, []);

  // Listen to profile photo change events across components
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string | null>;
      setPhotoURL(custom.detail);
    };
    window.addEventListener('abp-profile-photo-changed', handler);
    return () => window.removeEventListener('abp-profile-photo-changed', handler);
  }, []);

  async function updatePhotoURL(newPhoto: string | null) {
    if (user?.uid) {
      try {
        if (newPhoto) {
          localStorage.setItem(`abp_user_photo_${user.uid}`, newPhoto);
        } else {
          localStorage.removeItem(`abp_user_photo_${user.uid}`);
        }
      } catch (e) {
        console.warn('[Auth] localStorage photo write error:', e);
      }
    }
    setPhotoURL(newPhoto);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('abp-profile-photo-changed', { detail: newPhoto })
      );
    }
  }

  async function login(email: string, password: string, rememberMe: boolean) {
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    try {
      await signOut(auth);
      try {
        localStorage.removeItem('bhuiya_active_workspace');
        sessionStorage.clear();
      } catch {
        // Safe fallback
      }
      setUser(null);
      console.log('[Auth] Signed out successfully and cleared session cache');
    } catch (err) {
      console.error('[Auth] Sign out failed:', err);
      throw err;
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, photoURL, updatePhotoURL }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
