import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
    // Listen for auth changes (this fires immediately with current session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
          setIsLoading(false);
          // Fetch user from backend (includes app_role for Super Admin check)
          fetchUserFromBackend(session)
            .then(() => setUserDataReady(true))
            .catch(err => {
              console.error('Fetch user error:', err);
              setUserDataReady(true);
            });
        } else {
          setUser(null);
          setIsLoading(false);
          setUserDataReady(true);
        }
      }
    );

    // Fallback: if onAuthStateChange doesn't fire within 2s, stop loading
    const timeout = setTimeout(() => setIsLoading(false), 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

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
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) throw error;
    return data;
  };

  // Resend verification email
  const resendVerification = async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email
    });

    if (error) throw error;
  };

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
    }}>
      {children}
    </AuthContext.Provider>
  );
};
