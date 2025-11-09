const DEFAULT_ADMIN_EMAILS = ['admin@wisptools.io'];

const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS.join(','))
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isPlatformAdminEmail(email) {
  if (!email) {
    return false;
  }
  return PLATFORM_ADMIN_EMAILS.includes(email.toLowerCase());
}

module.exports = {
  PLATFORM_ADMIN_EMAILS,
  isPlatformAdminEmail
};

