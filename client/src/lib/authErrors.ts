export function googleErrorMessage(code: string | null): string | null {
  switch (code) {
    case 'google_not_configured': return 'Google sign-in is not configured yet. The API needs Google OAuth credentials and SERVER_URL on Vercel.';
    case 'google_state': return 'Google sign-in could not be verified. Please enable cookies, try again, and complete sign-in in the same browser.';
    case 'google_cancelled': return 'Google sign-in was cancelled. You can try again or use your email.';
    case 'google_failed':
    case 'google': return 'Google sign-in did not complete. Check the Google Cloud authorized redirect URI or try email sign-in.';
    default: return null;
  }
}
