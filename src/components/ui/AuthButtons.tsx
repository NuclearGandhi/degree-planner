import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const AuthButtons: React.FC = () => {
  const { currentUser, signInWithGoogle, signOut, loading } = useAuth();

  if (loading) {
    // Don't show anything while auth state is loading
    return <div className="w-20 h-8 animate-pulse bg-gray-300 dark:bg-gray-600 rounded"></div>; // Placeholder for loading
  }

  return (
    <div className="flex items-center gap-2">
      {currentUser ? (
        // User is logged in
        <>
          <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">
            {currentUser.displayName || currentUser.email}
          </span>
          <button
            onClick={signOut}
            className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
          >
            התנתק
          </button>
        </>
      ) : (
        // User is logged out
        <button
          onClick={signInWithGoogle} // Using Google Sign-In for simplicity
          className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-1"
        >
          {/* Basic Google Icon Placeholder */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 10.5H21V13.5H13.5V10.5Z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 10.5V3H10.5V10.5H3V13.5H10.5V21H13.5V13.5H21" /></svg>
          התחבר עם גוגל
        </button>
        // TODO: Optionally add Email/Password sign-in button here
      )}
    </div>
  );
}; 