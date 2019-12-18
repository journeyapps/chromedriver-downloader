# @journeyapps/chromedriver-downloader

Downloads a ChromeDriver version based on the currently installed Chrome version.

## Why?

ChromeDriver versions are strongly tied to specific Chrome versions. On developer machines, Chrome is typically the latest stable version, while CI environments would have a fairly static version.

This helps avoid the overhead of manually installing the correct ChromeDriver version every time the Chrome version changes.

## Usage

Node 10.x or later is required.

Install:

    yarn add --dev @journeyapps/chromedriver-downloader

Use:

    const { downloadChromeDriver } = require('@journeyapps/chromedriver-downloader');

    downloadChromeDriver().then(details => console.log(details));

For more options, look at the TypeScript definitions or source code.

## Protractor

Sample config for Protractor:

```js
// protractor.conf.js
const { downloadChromeDriver } = require('@journeyapps/chromedriver-downloader');

exports.config = {
  directConnect: true,
  capabilities: {
    browserName: 'chrome'
  },
  async beforeLaunch() {
    const { chromeDriverPath } = await downloadChromeDriver();
    exports.config.chromeDriver = chromeDriverPath;
  }
}
```
