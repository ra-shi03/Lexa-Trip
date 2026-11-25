import { isAppMode } from './lib/mode';

// One project, two experiences. Only the chosen one (and its CSS) is downloaded.
if (isAppMode()) import('./app/entry.jsx');
else import('./entry-web.jsx');
