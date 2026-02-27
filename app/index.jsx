import { useSelector } from 'react-redux';
import { Redirect } from 'expo-router';

export default function Index() {
  // PersistGate in _layout.jsx ensures the store is rehydrated before this renders,
  // so we can read Redux state synchronously here — no useEffect/loading needed.
  const backendUrl = useSelector((state) => state.auth.backendUrl);
  const userEmail = useSelector((state) => state.auth.userEmail);

  if (!backendUrl) return <Redirect href="/setup" />;
  if (!userEmail) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)/gallery" />;
}
