import fs from 'fs';
import { execSync } from 'child_process';
import t from 'tcomb';
import { merge } from 'lodash';
import getToken from './github/token';

t.interface.strict = true;

const getRootFolderPath = () => execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const relesorc = JSON.parse(fs.readFileSync(`${getRootFolderPath()}/.smooth-releaserc`));

const Config = t.interface({
  github: t.interface({
    token: t.maybe(t.String),
    changelog: t.interface({
      outputPath: t.String,
      ignoredLabels: t.list(t.String),
      breaking: t.interface({
        title: t.String,
        labels: t.list(t.String)
      }),
      bug: t.interface({
        title: t.String,
        labels: t.list(t.String)
      }),
      feature: t.interface({
        title: t.String
      })
    })
  }),
  publish: t.interface({
    branch: t.maybe(t.String),
    inSyncWithRemote: t.Boolean,
    noUncommittedChanges: t.Boolean,
    noUntrackedFiles: t.Boolean
  })
});

const defaultConfig = {
  github: {
    changelog: {
      outputPath: './CHANGELOG.md'
    }
  },
  publish: {
    branch: 'master',
    inSyncWithRemote: true,
    noUncommittedChanges: true,
    noUntrackedFiles: true
  }
};

const config = merge(defaultConfig, relesorc, { github: { token: getToken() } });

export default Config(config);
