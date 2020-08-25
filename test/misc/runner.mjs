/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

const TEST_PAGES_URL = process.env.TEST_PAGES_URL ||
                       "https://testpages.adblockplus.org/en/";
const TEST_PAGES_INSECURE = process.env.TEST_PAGES_INSECURE == "true";

import path from "path";
import url from "url";
import {exec} from "child_process";
import {promisify} from "util";
import got from "got";
import {checkLastError, loadModules} from "./utils.mjs";

function getBrowserBinaries(module, browser)
{
  let spec = process.env[`${browser.toUpperCase()}_BINARY`];
  if (spec)
  {
    if (spec == "installed")
      return [{getPath: () => Promise.resolve(null)}];
    if (spec.startsWith("path:"))
      return [{getPath: () => Promise.resolve(spec.substr(5))}];
    if (spec.startsWith("download:"))
    {
      if (module.ensureBrowser)
        return [{getPath: () => module.ensureBrowser(spec.substr(9))}];
      console.warn(`WARNING: Downloading ${browser} is not supported`);
    }
  }

  if (!module.ensureBrowser)
  {
    if (module.isBrowserInstalled())
      return [{getPath: () => Promise.resolve(null)}];
    return [];
  }

  return [
    {
      version: "oldest",
      getPath: () => module.ensureBrowser(module.oldestCompatibleVersion)
    },
    {
      version: "latest",
      getPath: () => module.getLatestVersion().then(module.ensureBrowser)
    }
  ];
}

async function createDevenv(platform)
{
  if (process.env.SKIP_BUILD != "true")
    await promisify(exec)(`gulp devenv -t ${platform} --experimental-modules`);
}

async function getDriver(binary, devenvCreated, module)
{
  let [browserBin] = await Promise.all([binary.getPath(), devenvCreated]);
  return module.getDriver(
    browserBin,
    path.resolve(`./devenv.${module.platform}`),
    TEST_PAGES_INSECURE
  );
}

async function logBrowserVersion(driver)
{
  let capabilities = await driver.getCapabilities();
  let browserVersion =
    capabilities.getBrowserVersion() || capabilities.get("version");
  // eslint-disable-next-line no-console
  console.log(`Browser: ${capabilities.getBrowserName()} ${browserVersion}`);
}

async function waitForExtension(driver)
{
  let handles;
  let origin;
  let extensionUrl;
  await driver.wait(async() =>
  {
    handles = await driver.getAllWindowHandles();
    for (let handle of handles)
    {
      await driver.switchTo().window(handle);
      [origin, extensionUrl] =
        await driver.executeScript("return [location.origin, location.href];");
      if (origin != "null" && extensionUrl.endsWith("first-run.html"))
        return true;
    }
    return false;
  }, 5000, "unknown extension page origin");

  await driver.switchTo().window(handles[1]);
  await driver.navigate().to(extensionUrl);

  return [handles[1], origin];
}

async function getPageTests()
{
  let options = TEST_PAGES_INSECURE ? {rejectUnauthorized: false} : {};
  let response;

  try
  {
    response = await got(TEST_PAGES_URL, options);
  }
  catch (e)
  {
    console.warn(`Warning: Test pages not parsed at "${TEST_PAGES_URL}"\n${e}`);
    return [];
  }

  let regexp = /"test-link" href="(.*?)"[\S\s]*?>(?:<h3>)?(.*?)</gm;
  let tests = [];
  let match;
  while (match = regexp.exec(response.body))
    tests.push([url.resolve(TEST_PAGES_URL, match[1]), match[2]]);

  return tests;
}

if (typeof run == "undefined")
{
  console.error("--delay option required");
  process.exit(1);
}

(async() =>
{
  let [pageTests, browsers, suites] = await Promise.all([
    getPageTests(),
    loadModules(path.join("test", "browsers")),
    loadModules(path.join("test", "suites"))
  ]);

  for (let [module, browser] of browsers)
  {
    let devenvCreated = null;
    for (let binary of getBrowserBinaries(module, browser))
    {
      let description = browser.replace(/./, c => c.toUpperCase());
      if (binary.version)
        description += ` (${binary.version})`;

      describe(description, function()
      {
        this.timeout(0);
        this.pageTests = pageTests;
        this.testPagesURL = TEST_PAGES_URL;

        before(async function()
        {
          if (!devenvCreated)
            devenvCreated = createDevenv(module.platform);

          this.driver = await getDriver(binary, devenvCreated, module);
          await logBrowserVersion(this.driver);
          [this.extensionHandle,
           this.extensionOrigin] = await waitForExtension(this.driver);
        });

        beforeEach(async function()
        {
          let handles = await this.driver.getAllWindowHandles();
          let defaultHandle = handles.shift();

          for (let handle of handles)
          {
            if (handle != this.extensionHandle)
            {
              try
              {
                await this.driver.switchTo().window(handle);
                await this.driver.close();
              }
              catch (e) {}
            }
          }

          await this.driver.switchTo().window(defaultHandle);
        });

        it("extension loaded without errors", async function()
        {
          await checkLastError(this.driver, this.extensionHandle);
        });

        for (let [{default: defineSuite}] of suites)
          defineSuite();

        after(async function()
        {
          if (this.driver)
            await this.driver.quit();

          if (module.shutdown)
            module.shutdown();
        });
      });
    }
  }
  run();
})();
