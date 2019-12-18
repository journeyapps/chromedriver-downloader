import * as spawn from 'cross-spawn';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as chromeFinder from 'chrome-launcher/dist/chrome-finder';
import * as unzipper from 'unzipper';
import findCacheDir = require('find-cache-dir');

type SupportedPlatforms = 'darwin' | 'linux' | 'win32';

const streamPipeline = promisify(pipeline);

export interface Options {
  /**
   * Specify to use a specific version of ChromeDriver, instead of auto-detecting.
   */
  chromeDriverVersion?: string;

  /**
   * Specify to use a specific version of Chrome, instead of auto-detecting.
   */
  chromeVersion?: string;

  /**
   * Specify to use a specific path to Chrome, instead of auto-detecting.
   */
  chromeBinary?: string;
}

/**
 * Download and cache ChromeDriver, if it isn't cached yet.
 *
 * @param options Use specific versions instead of auto-detecting.
 */
export async function downloadChromeDriver(options: Options = {}) {
  const chromeDriverDetails = await getChromeDriverDetails(options);
  const chromeDriverPath = await getChromeDriver(chromeDriverDetails.chromeDriverVersion);
  return {
    chromeDriverPath,
    ...chromeDriverDetails
  };
}

/**
 * Detect the version of ChromeDriver to use.
 */
export async function getChromeDriverDetails(options: Options = {}) {
  if (options.chromeDriverVersion) {
    return {
      chromeDriverVersion: options.chromeDriverVersion
    };
  }
  let chromeDetails: {
    chromeVersion: string;
    chromeBinary?: string;
  };
  if (options.chromeVersion) {
    chromeDetails = {
      chromeVersion: options.chromeVersion
    };
  } else {
    chromeDetails = await getChromeDetails(options);
  }
  const chromeDriverVersion = await fetchText(
    `https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${chromeDetails.chromeVersion}`
  );
  return {
    chromeDriverVersion,
    ...chromeDetails
  };
}

/**
 * Get major.minor.patch version of chrome.
 */
export async function getChromeDetails(options: Pick<Options, 'chromeBinary'> = {}) {
  const path = await getChromePath(options);
  const versionString = spawn.sync(path, ['--version']).stdout.toString();
  const versionMatch = versionString.match(/\s(\d+\.\d+\.\d+)\.\d+/);
  if (versionMatch == null) {
    throw new Error(`Unable to parse version from ${JSON.stringify(versionString)}`);
  }
  return {
    chromeVersion: versionMatch[1],
    chromeBinary: path
  };
}

async function getChromeDriver(chromeDriverVersion: string): Promise<string> {
  const cacheName = require('../package.json').name;
  const cachePath = findCacheDir({ name: cacheName, create: true });
  if (cachePath == null) {
    throw new Error('Could not find a cache path');
  }
  const driverPlatform = getDriverPlatform();

  const dest = path.join(cachePath, `chromedriver_${chromeDriverVersion}_${driverPlatform}`);
  let driverPath = path.join(dest, 'chromedriver');
  if (process.platform == 'win32') {
    driverPath += '.exe';
  }

  if (fs.existsSync(driverPath)) {
    return driverPath;
  }

  const url = `https://chromedriver.storage.googleapis.com/${chromeDriverVersion}/chromedriver_${driverPlatform}.zip`;
  await downloadAndUnzip(url, dest);
  fs.chmodSync(driverPath, '770');
  return driverPath;
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return await response.text();
}

async function downloadAndUnzip(url: string, dest: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  const stream = unzipper.Extract({ path: dest });
  await streamPipeline(response.body, stream);
}

function getDriverPlatform() {
  if (process.platform == 'linux') {
    return 'linux64';
  } else if (process.platform == 'darwin') {
    return 'mac64';
  } else if (process.platform == 'win32') {
    return 'win32';
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

export async function getChromePath(options: Pick<Options, 'chromeBinary'> = {}): Promise<string> {
  if (options.chromeBinary) {
    return options.chromeBinary;
  } else {
    const paths: string[] = chromeFinder[process.platform as SupportedPlatforms]();
    if (paths.length == 0) {
      throw new Error('No chrome installation found');
    }
    return paths[0];
  }
}
