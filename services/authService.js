import axios from 'axios';

/**
 * Login using NextAuth credentials provider.
 * Returns { backendUrl, userEmail } on success.
 * Caller is responsible for dispatching setAuth() to the Redux store.
 */
export async function login(baseUrl, email, password) {
  const normalizedUrl = baseUrl.replace(/\/$/, '');
  console.log('[auth] login start — url:', normalizedUrl, 'email:', email);

  // Step 1: get CSRF token
  let csrfRes;
  try {
    csrfRes = await axios.get(`${normalizedUrl}/api/auth/csrf`);
    console.log('[auth] CSRF status:', csrfRes.status, 'data:', JSON.stringify(csrfRes.data));
  } catch (err) {
    console.error('[auth] CSRF failed:', err.message, err.response?.status);
    throw new Error(`Cannot reach server: ${err.message}`);
  }

  const csrfToken = csrfRes.data?.csrfToken;
  if (!csrfToken) {
    throw new Error('Could not retrieve CSRF token from server.');
  }

  // Step 2: submit credentials — let redirects follow so the session cookie
  // is stored in the native cookie jar (NSURLSession / OkHttp).
  const params = new URLSearchParams();
  params.append('csrfToken', csrfToken);
  params.append('email', email);
  params.append('password', password);
  params.append('callbackUrl', normalizedUrl);

  try {
    const loginRes = await axios.post(
      `${normalizedUrl}/api/auth/callback/credentials`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log('[auth] credentials POST status:', loginRes.status);
  } catch (err) {
    console.error('[auth] credentials POST failed:', err.message, err.response?.status);
    throw new Error(`Login request failed: ${err.message}`);
  }

  // Step 3: verify session — the cookie jar now has the session cookie
  let sessionRes;
  try {
    sessionRes = await axios.get(`${normalizedUrl}/api/auth/session`);
    console.log('[auth] session:', JSON.stringify(sessionRes.data));
  } catch (err) {
    console.error('[auth] session check failed:', err.message);
    throw new Error(`Session check failed: ${err.message}`);
  }

  const userEmail = sessionRes.data?.user?.email;
  if (!userEmail) {
    throw new Error('Login failed: invalid credentials.');
  }

  console.log('[auth] login success — user:', userEmail);
  return { backendUrl: normalizedUrl, userEmail };
}

/**
 * Sign out from NextAuth server-side.
 * Caller handles Redux state update and navigation.
 */
export async function logout(baseUrl) {
  if (!baseUrl) return;
  try {
    const csrfRes = await axios.get(`${baseUrl}/api/auth/csrf`);
    const csrfToken = csrfRes.data?.csrfToken;
    if (csrfToken) {
      const params = new URLSearchParams();
      params.append('csrfToken', csrfToken);
      params.append('callbackUrl', baseUrl);
      await axios.post(
        `${baseUrl}/api/auth/signout`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
    }
  } catch (err) {
    console.warn('[auth] signout request failed (ignoring):', err.message);
  }
}
