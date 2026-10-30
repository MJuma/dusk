import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';

import { App } from './app/App';
import './styles/app.css';

render(<App />, document.getElementById('app') as HTMLElement);

if (import.meta.env.PROD) {
    // A new version installs in the background and takes over on the next launch.
    void registerSW({ immediate: true });
}
