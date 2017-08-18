'use babel';

import { exec } from 'child_process';
import fs from 'fs';

//import os from 'os';
//export const CHCP =(os.type() == 'Windows_NT')? 'chcp 65001 && ': '';

export const PACKAGE_MANIFEST_PATH = `${process.env.HOME}/.atom/packages.json`;
export const APM_PATH=atom.packages.getApmPath();

// OS X apps don't inherit PATH, so reconstruct it. This is a bug, filed
// against Atom here: https://github.com/atom/atom-shell/issues/550
const PATH = process.platform === 'darwin' ?
              'eval `/usr/libexec/path_helper -s`' :
              process.env.PATH;

const execOptions = {
  env: process.env,
  shell: process.env.SHELL
};                                      

function run(command) {
   return new Promise((resolve, reject) => {
   exec(`${command}`, execOptions, (error, stdout, stderr) => {
      if (error) {
        atom.notifications.addError('Error occured by run command: ',{detail: error.reason || error.message , dismissable: true});
        reject(error);
      }
      resolve(stdout);
    });
  });
}

export function isPackageInstalled(packageName) {
  return new Promise((resolve, reject) => {
    listPackages().then(installedPackages => {
      resolve(installedPackages.includes(packageName));
    }).catch((error) => {
      reject(error);
    });
  });
}

export function listPackages() {
//  console.log('Listing packages');
  return new Promise((resolve, reject) => {
//  console.log('Running listing packages');
    run(APM_PATH+` list --installed --bare`).then(result => {
//      atom.notifications.addInfo('trimming results');
      const trimmedOutput = result.trim().split('\n');
      const withoutVersion = trimmedOutput.map(p => p.slice(0, p.indexOf('@')));
//      atom.notifications.addInfo('found '+withoutVersion);
//      return withoutVersion;
      resolve(withoutVersion);
    }).catch(err => {
      atom.notifications.addError(err);
    });
  });
}

function writePackageManifest(packages) {
  const fileContents = JSON.stringify({
    packages: [
      ...packages
    ]
  }, null, 2);
  try {
    fs.writeFileSync(PACKAGE_MANIFEST_PATH, fileContents);
    atom.notifications.addSuccess(`Created package manifest in ${PACKAGE_MANIFEST_PATH}`);
  } catch (e) {
    console.log(e);
    throw new Error(`Error while creating manifest file (${e})`);
  }
}

function createPackageManifest() {
  return listPackages().then((packages) => {
    console.log("Writing manifest file");
//    atom.notifications.addInfo('Writing manifest');
    writePackageManifest(packages);
    return packages;
  });
}

export function readPackageManifest() {
  try {
    // TODO: determine if fs.accessSync call is necessary
    // or if just letting fs.readFile throw inside the
    // try/catch would be fine.
    fs.accessSync(PACKAGE_MANIFEST_PATH);
    const fileContents = fs.readFileSync(PACKAGE_MANIFEST_PATH, 'utf8');
    const parsedManifest = JSON.parse(fileContents);
    // FIXME: ಠ_ಠ maybe re-write this function so this isn't necessary
    return Promise.resolve(parsedManifest.packages);
  } catch(e) {
    atom.notifications.addInfo('No package manifest found, creating one in '+PACKAGE_MANIFEST_PATH);
    return createPackageManifest();
  }
}

function installMissingPackages(manifest, installedPackages) {
  return new Promise((resolve, reject) => {
    const installedSet = new Set(installedPackages);
    const packagesToInstall = manifest.filter(x => !installedSet.has(x));
    if (packagesToInstall.length > 0) {
      const packageList = packagesToInstall.join(' ');
      const command = APM_PATH+` install ${packageList}`;
      run(command).then(result => resolve(result));
    } else {
      resolve('No packages to install');
    }
  });
}

export function addPackageToManifest(package, manifest = undefined) {
  if (manifest) {
    writePackageManifest([...manifest, package.name]);
  } else {
    readPackageManifest().then(packageManifest => {
      writePackageManifest([...packageManifest, package.name]);
    });
  }
}

export function removePackageFromManifest(package, manifest = undefined) {
  if (manifest) {
    writePackageManifest(manifest.filter(p => p !== package.name));
  } else {
    readPackageManifest().then(packageManifest => {
      writePackagedManifest(packageManifest.filter(p => p !== package.name));
    });
  }
}

export function init() {
  readPackageManifest().then((manifest) => {
    listPackages().then((installedPackages) => {
      installMissingPackages(manifest, installedPackages).then(result => {
        atom.notifications.addInfo(result);
      });
    });
  });
}
