import fs from 'fs';
import publish from './npm/publish';
import release from './github/release';
import changelog from './github/changelog';
import { onError, getRootFolderPath } from './utils';

const packageJSON = JSON.parse(fs.readFileSync(`${getRootFolderPath()}/package.json`));

Promise.resolve()
  .then(() => publish())
  .then(() => release(packageJSON.version))
  .then(() => changelog())
  .catch(onError);
