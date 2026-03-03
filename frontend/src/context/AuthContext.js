import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userDataReady, setUserDataReady] = useState(false);

  useEffect(() => {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, using fallback auth');
      checkFallbackAuth();
      return;
    }

    // Set loading false immediately - auth state will update via listener
    setIsLoading(false);

    // Listen for auth changes (this fires immediately with current session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        if (session?.user) {
          setUserDataReady(false);
          // Set user immediately from Supabase data for fast UI
          setUser({
            user_id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
            picture: session.user.user_metadata?.avatar_url
          });
          // Fetch user from backend (includes app_role for Super Admin check)
          fetchUserFromBackend(session)
            .then(() => setUserDataReady(true))
            .catch(err => {
              console.error('Fetch user error:', err);
              setUserDataReady(true);
            });
        } else {
          setUser(null);
          setUserDataReady(true);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fallback auth check (for when Supabase is not configured)
  const checkFallbackAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
      setUserDataReady(true);
    }
  };

  // Fetch user from backend - backend auto-creates user if needed from JWT
  const fetchUserFromBackend = async (session) => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      // Update user state with backend user data (includes correct user_id and app_role)
      if (response.data) {
        setUser({
          user_id: response.data.user_id,
          email: response.data.email,
          name: response.data.name,
          picture: response.data.picture,
          app_role: response.data.app_role || 'user'
        });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      // Keep Supabase data as fallback
    }
  };

  // Check if user is a Super Admin
  const isSuperAdmin = () => {
    return user?.app_role === 'super_admin';
  };

  // Check if user is staff (Super Admin or Org Admin)
  const isStaff = () => {
    return user?.app_role === 'super_admin' || user?.app_role === 'org_admin';
  };

  // Sign up with email/password
  const signUp = async (email, password, name) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }
    
    let signUpData = null;
    let signUpError = null;
    
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/login`
        }
      });
      signUpData = result.data;
      signUpError = result.error;
    } catch (err) {
      console.error('Supabase signup error:', err);
      throw new Error(err.message || 'Signup failed. Please try again.');
    }
    
    if (signUpError) {
      throw signUpError;
    }
    
    // Backend will auto-create user when they first call /auth/me with valid JWT
    // No need to sync here - the auth state listener handles it
    
    return signUpData;
  };

  // Sign in with email/password
  const signIn = async (email, password) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }
    
    let signInData = null;
    let signInError = null;
    
    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password
      });
      signInData = result.data;
      signInError = result.error;
    } catch (err) {
      console.error('Supabase signin error:', err);
      throw new Error(err.message || 'Login failed. Please try again.');
    }
    
    if (signInError) {
      throw signInError;
    }

    // Auth listener will handle syncUserToBackend
    // Return user data for welcome screen
    return {
      user_id: signInData?.user?.id,
      email: signInData?.user?.email,
      name: signInData?.user?.user_metadata?.name || signInData?.user?.email?.split('@')[0]
    };
  };

  // Reset password
  const resetPassword = async (email) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) throw error;
    return data;
  };

  // Resend verification email
  const resendVerification = async (email) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email
    });

    if (error) throw error;
  };

  // Sign out
  const signOut = async () => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    
    // Also logout from backend
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      // Ignore backend logout errors
    }
    
    setUser(null);
    setSession(null);
  };

  // Get access token for API calls
  const getAccessToken = () => {
    return session?.access_token || null;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      userDataReady,
      signUp,
      signIn,
      signOut,
      resetPassword,
      resendVerification,
      getAccessToken,
      setUser,
      isSuperAdmin,
      isStaff,
      isSupabaseConfigured: isSupabaseConfigured()
    }}>
      {children}
    </AuthContext.Provider>
  );
};
