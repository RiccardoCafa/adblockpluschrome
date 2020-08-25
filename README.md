[![Pipeline status](https://gitlab.com/eyeo/adblockplus/adblockpluschrome/badges/master/build.svg)](https://gitlab.com/eyeo/adblockplus/adblockpluschrome/pipelines/)

Adblock Plus for Chrome, Opera, Microsoft Edge and Firefox
==========================================================

This repository contains the platform-specific Adblock Plus source code for
Chrome, Opera, Microsoft Edge and Firefox. It can be used to build
Adblock Plus for these platforms, generic Adblock Plus code will be extracted
from other repositories automatically (see _dependencies_ file).

Note that the Firefox extension built from this repository is the new
[WebExtension](https://developer.mozilla.org/en-US/Add-ons/WebExtensions).
The source code of the legacy Adblock Plus extension
can be found [here](https://hg.adblockplus.org/adblockplus).

Building
---------

### Requirements

- [Mercurial](https://www.mercurial-scm.org/) or [Git](https://git-scm.com/) (whichever you used to clone this repository)
- [Python 2.7](https://www.python.org)
  - [The Jinja2 module](http://jinja.pocoo.org/docs) (>= 2.8)
  - For signed builds: [PyCrypto module](https://www.dlitz.net/software/pycrypto/)
- [Node.js](https://nodejs.org/) (>= 10.17.0, >= 12 on Windows)

### Building on Windows

On Windows, you need a [Linux environment running on WSL](https://docs.microsoft.com/windows/wsl/install-win10).
Then install the above requirements and run the commands below from within Bash.

### Building the extension

Run one of the following commands in the project directory, depending on your
target platform:

    ./build.py build -t chrome -k adblockpluschrome.pem
    ./build.py build -t gecko

This will create a build with a name in the form
_adblockpluschrome-1.2.3.nnnn.crx_ or _adblockplusfirefox-1.2.3.nnnn.xpi_.

Note that you don't need an existing signing key for Chrome, a new key
will be created automatically if the file doesn't exist.

The Firefox extension will be unsigned, and therefore is mostly only useful for
upload to Mozilla Add-ons. You can also load it for testing purposes under
_about:debugging_ or by disabling signature enforcement in Firefox Nightly.

### Development environment

To simplify the process of testing your changes you can create an unpacked
development environment. For that run one of the following commands:

    ./build.py devenv -t chrome
    ./build.py devenv -t gecko

This will create a _devenv.*_ directory in the repository. You can load the
directory as an unpacked extension under _chrome://extensions_ in Chrome or Edge
and under _about:debugging_ in Firefox. After making changes to the source code
re-run the command to update the development environment, and the extension
should reload automatically after a few seconds.

The build script calls the ensure_dependencies script automatically to manage
the dependencies (see _dependencies_ file). Dependencies with local
modifications won't be updated. Otherwise during development specifying a
feature-branch's name for a dependency's revision is sometimes useful.
Alternatively dependency management can be disabled completely by setting the
_SKIP_DEPENDENCY_UPDATES_ environment variable, for example:

    SKIP_DEPENDENCY_UPDATES=true ./build.py devenv -t chrome

Alternative building
--------------------

An alternative build system that uses Node.js and [Gulp](https://gulpjs.com)
instead of Python is available.
It's currently used on the CI pipeline and on local test execution.

### Usage

To build with Node, first, make sure to call the ensure_dependencies script:

    ./ensure_dependencies.py

And install the npm packages with:

    npm install

Building is available for Chrome and Firefox:

    npx gulp devenv -t {chrome|gecko} --experimental-modules

By default, these commands create an unpacked development build.
If that's not what you want, use this instead:

    npx gulp build -t {chrome|gecko} -c {development|release} --experimental-modules

### Notes

- If you have the `gulp-cli` npm package installed globally,
you don't need to use `npx` for the above commands,
just make sure that the version is 2.3.0 or above.
- On Windows, you still need to have WSL installed and run the commands
from within Bash.

### Customization
If you wish to create an extension based on our code and use the same
build tools, we offer some customization options.

This can be done by:

 - Specifying a path to a new configuration file relative to `gulpfile.mjs`
(it should match the structure found in `build/config/`).
    
        npx gulp <devenv|build> -t {chrome|gecko} --config "pathToConfig.mjs" --experimental-modules

 - Specifying a path to a new `manifest.json` file relative to `gulpfile.mjs`.
You should check `build/manifest.json` and `build/tasks/manifest.mjs` to see
how we modify it.

        npx gulp <devenv|build> -t {chrome|gecko} -m "pathToManifest.json" --experimental-modules


Running tests
-------------

### Unit tests

To verify your changes you can use the unit test suite located in the _qunit_
directory of the repository. In order to run the unit tests go to the
extension's Options page, open the JavaScript Console and type in:

    location.href = "qunit/index.html";

The unit tests will run automatically once the page loads.

### External test runner

There is also an external test runner that can be invoked from the
command line in order to run the unit tests along some integration
tests on different browsers, and automatically run the linter as well.

On Windows, in order to use the test runner, in addition to setting up a Linux
environment as outlined above, you need to have Node.js installed in your native
Windows environment. Then run the commands below from within PowerShell or
cmd.exe (unlike when building the extension which needs to be done from Bash).

On Linux, newer versions of Chromium require `libgbm`.

Make sure the required packages are installed and up-to-date:

    npm install

Start the testing process for all browsers:

    npm test

Start the testing process in one browser only:

    npm test -- -g <Firefox|Chromium|Edge>

In order to run other test subsets, please check `-g` option on
[Mocha's documentation](https://mochajs.org/#-grep-regexp-g-regexp).

By default it downloads (and caches) and runs the tests against the
oldest compatible version and the latest release version of each browser.
In order to run the tests against a different version set the `CHROMIUM_BINARY`,
`FIREFOX_BINARY` or `EDGE_BINARY` environment variables. Following values are
accepted:

* `installed`
  * Uses the version installed on the system.
* `path:<path>`
  * Uses the binary located at the given path.
* `download:<version>`
  * Downloads the given version (for Firefox the version must be in the
    form `<major>.<minor>`, for Chromium this must be the revision number).
    This option is not available for Edge.

Filter tests subset uses [ABP Test pages](https://testpages.adblockplus.org/).
In order to run those tests on a different version of the test pages, set
the _TEST_PAGES_URL_ environment variable. Additionally, in order to accept
insecure `https` certificates set the _TEST_PAGES_INSECURE_ environment variable
to `"true"`.

[Edge Chromium](https://www.microsoft.com/en-us/edge/business/download) needs to
be installed before running the Edge tests.

Linting
-------

You can lint the code using [ESLint](http://eslint.org).

You will need to setup first. This will install our configuration
[eslint-config-eyeo](https://hg.adblockplus.org/codingtools/file/tip/eslint-config-eyeo)
and everything needed after you run:

    npm install

Then you can run to lint the code:

    npm run lint
