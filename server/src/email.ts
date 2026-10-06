// No email provider is wired up yet (planned for the Render deploy). Until then the link is
// printed in development, and never in production, where it would leak a working reset token.
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No email provider configured');
  }
  console.log(`Password reset for ${to}: ${resetLink}`);
}
