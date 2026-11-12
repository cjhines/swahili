import { join } from 'node:path';
import { normalizePath, type Plugin } from 'vite';

import { checkFixtures } from '../../nani/fixtures.ts';
import { formatErrors, parseDecks } from '../validate.ts';
import {
  loadDeckSources,
  loadNaniFixtures,
  loadNaniRules,
  NANI_DIR,
  VOCAB_DIR,
} from './load.ts';

const MODULES = {
  'virtual:decks': (root: string) => {
    const { decks, errors } = parseDecks(loadDeckSources(root));
    return { data: decks, errors };
  },
  'virtual:nani': (root: string) => {
    const rules = loadNaniRules(root);
    const fixtures = loadNaniFixtures(root);
    if (!rules.data || !fixtures.data)
      return { data: undefined, errors: [...rules.errors, ...fixtures.errors] };
    // Never ship grammar that contradicts the known-correct forms.
    const { errors } = checkFixtures(rules.data, fixtures.data, {
      path: fixtures.path,
      at: fixtures.at,
    });
    return {
      data: { rules: rules.data },
      errors,
    };
  },
};
type VirtualId = keyof typeof MODULES;
const isVirtual = (id: string): id is VirtualId => id in MODULES;

/**
 * Serves validated content as virtual modules:
 *   import decks from 'virtual:decks'   every vocabulary deck
 *   import nani from 'virtual:nani'     { rules }: the Nani na Lini? grammar (fixtures stay out)
 * An invalid file, or rules that contradict a fixture, fails `vite build` (and shows the error
 * overlay in dev) with file:line, so broken content can never be deployed. Editing any of it
 * reloads the page.
 */
export const decksPlugin = (): Plugin => {
  let root = process.cwd();

  return {
    name: 'swahili-content',

    configResolved(config) {
      root = config.root;
    },

    resolveId(id) {
      return isVirtual(id) ? `\0${id}` : undefined;
    },

    load(id) {
      const name = id.slice(1);
      if (!id.startsWith('\0') || !isVirtual(name)) return undefined;
      const { data, errors } = MODULES[name](root);
      if (errors.length)
        this.error(`Invalid content files:\n${formatErrors(errors)}`);
      return `export default ${JSON.stringify(data)};`;
    },

    configureServer(server) {
      const dirs = [VOCAB_DIR, NANI_DIR].map((dir) =>
        normalizePath(join(root, dir))
      );
      server.watcher.add(dirs);
      const reload = (file: string) => {
        if (!dirs.some((dir) => normalizePath(file).startsWith(dir))) return;
        for (const name of Object.keys(MODULES)) {
          const mod = server.moduleGraph.getModuleById(`\0${name}`);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher
        .on('add', reload)
        .on('change', reload)
        .on('unlink', reload);
    },
  };
};
