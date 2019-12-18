import { getChromePath, getChromeDetails, downloadChromeDriver, getChromeDriverDetails } from '../src/index';

describe('chromedriver-downloader', function() {
  it('should get the path to chrome', async function() {
    // Some examples:
    //  /usr/bin/google-chrome-stable
    //  /usr/bin/chromium
    //  Google Chrome
    expect(await getChromePath()).toMatch(/chrom/i);

    expect(await getChromePath({ chromeBinary: 'edge.exe' })).toEqual('edge.exe');
  });

  it("should get Chrome's version", async function() {
    expect((await getChromeDetails()).chromeVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should get the relevant ChromeDriver version', async function() {
    expect((await getChromeDriverDetails()).chromeDriverVersion).toMatch(/^\d+\.\d+\.\d+\.\d+$/);

    expect(await getChromeDriverDetails({ chromeVersion: '76.0.3809' })).toEqual({
      chromeDriverVersion: '76.0.3809.126',
      chromeVersion: '76.0.3809'
    });

    expect(await getChromeDriverDetails({ chromeDriverVersion: '1.2.3' })).toEqual({ chromeDriverVersion: '1.2.3' });
  });

  it('should download ChromeDriver', async function() {
    const { chromeDriverPath: path } = await downloadChromeDriver();
    expect(path).toMatch(/chromedriver/i);

    const { chromeDriverPath: path2 } = await downloadChromeDriver();
    expect(path2).toEqual(path);
  });
});
