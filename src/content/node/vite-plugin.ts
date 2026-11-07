import { join } from 'node:path';
import { normalizePath, type Plugin } from 'vite';

import { formatErrors, parseDecks } from '../validate.ts';
import { loadDeckSources, VOCAB_DIR } from './load.ts';

const VIRTUAL_ID = 'virtual:decks';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Serves the validated decks as `import decks from 'virtual:decks'`. An invalid deck fails
 * `vite build` (and shows the error overlay in dev) with file:line for every problem, so a
 * broken deck can never be deployed. Editing, adding or removing a deck file reloads the page.
 */
export const decksPlugin = (): Plugin => {
  let root = process.cwd();

  return {
    name: 'swahili-decks',

    configResolved(config) {
      root = config.root;
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },

    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const { decks, errors } = parseDecks(loadDeckSources(root));
      if (errors.length)
        this.error(`Invalid deck files:\n${formatErrors(errors)}`);
      return `export default ${JSON.stringify(decks)};`;
    },

    configureServer(server) {
      const dir = normalizePath(join(root, VOCAB_DIR));
      server.watcher.add(dir);
      const reload = (file: string) => {
        if (!normalizePath(file).startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher
        .on('add', reload)
        .on('change', reload)
        .on('unlink', reload);
    },
  };
};
