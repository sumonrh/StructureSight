import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../utils/firebase';
import { ShieldCheck, AlertTriangle, Key, Cpu, Sparkles } from 'lucide-react';

interface LoginProps {
  onLoginStart?: () => void;
  onLoginError?: (error: string) => void;
}

export default function Login({ onLoginStart, onLoginError }: LoginProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    if (onLoginStart) onLoginStart();

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      let errMsg = "Failed to sign in with Google. Please try again.";
      if (err.code === "auth/popup-blocked") {
        errMsg = "Sign-in popup was blocked by your browser. Please enable popups for this site.";
      } else if (err.code === "auth/configuration-not-found") {
        errMsg = "Google Sign-in is not enabled in Firebase Console. Please ask the administrator to enable Google provider in Authentication Settings.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
      if (onLoginError) onLoginError(errMsg);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden font-sans">
      {/* Decorative premium background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="z-10 w-full max-w-md p-8 bg-slate-900/60 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl space-y-8 transition-all hover:border-slate-700/60">
        
        {/* Branding & Icons */}
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400 animate-bounce shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <ShieldCheck className="h-10 w-10" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              StructureSight
            </h1>
            <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
              AI-Powered Structural Blueprint Review & Engineering Co-Pilot
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-3 text-left pt-2">
          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1">
            <Cpu className="h-4 w-4 text-blue-400" />
            <h4 className="text-xs font-semibold text-white">AI Checklist</h4>
            <p className="text-[10px] text-slate-500">Auto-generate standard review points</p>
          </div>
          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h4 className="text-xs font-semibold text-white">Co-Pilot Chat</h4>
            <p className="text-[10px] text-slate-500">Context-aware drawing query answering</p>
          </div>
        </div>

        {/* Action Button & Errors */}
        <div className="space-y-4 pt-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex gap-2.5 items-start">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-100 disabled:bg-slate-200 text-slate-900 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed group active:translate-y-0"
          >
            {isSigningIn ? (
              <div className="h-5 w-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="h-5 w-5 shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 0, 0)">
                  <path d="M21.35,11.1H12v2.7h5.38C17.11,15.19,15.01,17,12,17c-3.15,0-5.7-2.55-5.7-5.7s2.55-5.7,5.7-5.7c1.47,0,2.77,0.56,3.77,1.49l2.02-2.02C16.16,3.52,14.24,3,12,3C7.03,3,3,7.03,3,12s4.03,9,9,9c4.8,0,8.8-3.4,8.8-9C20.8,11.75,21.35,11.1,21.35,11.1Z" fill="#EA4335" />
                  <path d="M12,17c3.15,0,5.7-2.55,5.7-5.7h-5.7V8.5h9.1C21.2,9.6,21.35,10.7,21.35,12c0,5.6-4,9-8.8,9C7.03,21,3,16.97,3,12h3.3C6.3,14.65,8.85,17,12,17Z" fill="#4285F4" fillRule="nonzero" />
                  <path d="M15.77,8.79l2.02-2.02C16.16,5.18,14.24,4.66,12,4.66c-3.15,0-5.7,2.55-5.7,5.7H3C3,5.36,7.03,1.33,12,1.33C14.7,1.33,16.99,2.33,18.73,4l-2.96,4.79Z" fill="#FBBC05" />
                  <path d="M12,22.67c-4.97,0-9-4.03-9-9H6.3c0,3.15,2.55,5.7,5.7,5.7c3.15,0,5.7-2.55,5.7-5.7h3.35C21,18.64,16.97,22.67,12,22.67Z" fill="#34A853" />
                </g>
              </svg>
            )}
            <span>{isSigningIn ? 'Authenticating...' : 'Sign in with Google'}</span>
          </button>
        </div>

        {/* Footer lock label */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-mono">
          <Key className="h-3 w-3" />
          <span>Secured by Firebase OAuth Provider</span>
        </div>

      </div>
    </div>
  );
}
