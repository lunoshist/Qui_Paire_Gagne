/**
 * Racine de l'app : routage minimal entre l'Accueil (`/`) et la Salle
 * d'attente (`/room/:code`).
 */

import { useRoute } from './router';
import { Home } from './screens/Home';
import { Room } from './screens/Room';

export function App() {
  const { route, navigate } = useRoute();

  if (route.name === 'room') {
    // `key` force un remontage (et donc une nouvelle connexion WS) si on change de salle.
    return <Room key={route.code} code={route.code} navigate={navigate} />;
  }
  return <Home navigate={navigate} />;
}
