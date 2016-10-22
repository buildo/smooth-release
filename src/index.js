import publish from './npm/publish';
import release from './github/release';
import changelog from './github/changelog';
import { onError } from './utils';
import packageJSON from '../package.json';

publish()
  .then(() => release(packageJSON.version))
  .then(() => changelog())
  .catch(onError);
