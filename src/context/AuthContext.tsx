import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { ensureUserProfile, getCurrentUserProfile } from '../lib/tickets';
import { supabase } from '../lib/supabase';
import type { AppUser } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<{ needsEmailVerification: boolean }>;
  resendVerificationEmail: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  isManagerOrSupport: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile(nextUser: User | null) {
    if (!nextUser?.email) {
      setProfile(null);
      return;
    }

    await ensureUserProfile({
      uid: nextUser.id,
      email: nextUser.email,
      displayName: nextUser.user_metadata?.display_name as string | undefined,
    });

    const userProfile = await getCurrentUserProfile(nextUser.id);
    setProfile(userProfile);
  }

  useEffect(() => {
    let mounted = true;

    async function loadProfileForUser(nextUser: User | null) {
      try {
        await refreshProfile(nextUser);
      } catch (error) {
        console.error('Profile load failed:', error);
        if (mounted) {
          setProfile(null);
        }
      }
    }

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setLoading(false);
        void loadProfileForUser(currentUser);
      } catch (error) {
        console.error('Initial auth load failed:', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setLoading(false);

      setTimeout(() => {
        if (!mounted) return;
        void loadProfileForUser(nextUser);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw error;
    }
  }

  async function register(email: string, password: string): Promise<{ needsEmailVerification: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      return { needsEmailVerification: true };
    }

    if (data.session?.user && data.user.email) {
      await ensureUserProfile({ uid: data.user.id, email: email.trim() });
      return { needsEmailVerification: false };
    }

    return { needsEmailVerification: true };
  }

  async function resendVerificationEmail(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      throw error;
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  async function changePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw error;
    }
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      login,
      register,
      resendVerificationEmail,
      changePassword,
      logout,
      isManagerOrSupport: profile?.role === 'manager' || profile?.role === 'support',
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
