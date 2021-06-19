# Local build reference
## Requirements
ZorroTracker is built with TypeScript, HTML5 and LESS. Therefore, a fair few requirements are needed to correctly build it. Not all possible configurations are tested, so while others than what is listed here may work, they are not officially supported. Here are a few pointers to get you started.

| Operating system | Arch       | Version       | NodeJS version |
| ---------------- | ---------- | ------------- | -------------- |
| Windows          | x64        | 10            | 15.6, 16.3     |
| MacOS            | x64        |               |                |
| Linux            | x64        | Ubuntu 20.04  | 15.14          |

You can check your NodeJS version - if it's even installed - with `node -v`. If the major versions match, it is often good enough to work.

This table above should be filled in as more systems are validated to work and successfully build.

Additionally, [Visual C++](https://support.microsoft.com/en-us/topic/the-latest-supported-visual-c-downloads-2647da03-1eea-4433-9aff-95f26a218cc0) seems to be necessary to have installed beforehand.

Because of how the Javascript ecosystem works, a lot of disk space is required for all the plugins and build objects. It is recommended to have at least **3 GB** of free disk space before attempting to build ZorroTracker.

## Cloning
Next step is of course to clone the Git repository. However, as this Git repository uses git submodules, there are a few gotchas. Normal git clone (whether via commandline, or with a git client) may not actually clone the submodules, which are *very* necessary. You may be able to do that manually with your git client, or [do it via commandline using these instructions.](https://stackoverflow.com/questions/3796927/how-to-git-clone-including-submodules)

To verify you have done it correctly, check the subdirectories inside the `vendor` directory. If they are empty, the submodules are not cloned correctly.

## Building
### Initializing
Now that we have cloned the code, and ensured that we have all the pre-requisites installed, it is time to install the npm modules. You can do this with `npm install`. This may take a few minutes, because there are a lot of things to install, download and even build. You may get some warnings, or even errors during the installation process. Pay very close attention to errors, as this may show some extra things you need to install, or do, to get builds working. **If there are extra things to install, or it flat out does not work, let the developers know**. It's important we update this document over time to cover more areas.

### Building
Next, we can build everything! Run `npm run build`, and watch the output. It will look messy, but should not have errors. If you have errors or otherwise the build does not work, try doing it a few times (no really, sometimes it just works the second time). Building may take a few minutes, but should create the `build` directory, containing the files for a working ZorroTracker.

### Testing
After a successful build, you can now test the output. Run `npm run electron` to launch the program from the `build` directory. The program should start up normally. However, there may be issues, such as no sound, freezing, or not lauching at all. If that is the case, please examine the `build/ZorroTracker.log` file, should it exist. This may give you hints why its not working. *There is currently an issue, where sometimes the UI will not work, until the window itself is moved.*

If you can't make the program work and there is no obvious issue, please send an issue ticket, or join our Discord so we can help you figure out why

### Packaging
Finally, if everything works so far, you can package ZorroTracker. For most usecases, you probably want to use a simple folder packager. To do this, run `npm run pack`. This should output to `dist/xyz-unpackaged`, where xyz represents your operating system. This may sometimes fail for any reason, so again, please be in contact with the developers if this happens and you can't fix it.

Alternatively, you can package to many of the default output formats via `npm run ci_deploy`. *However*, this only supports a small subset of formats. At the time of writing this, it will not build anything except Windows x64, Linux x64 and MacOS x64. You would have to edit the `package.json` file to allow custom build formats as well. This is currently not officially supported, but in the future we will have instructions for building to custom formats.

## Non-supported configurations
We need people to test these! For example, ARM versions, earlier/later OS releases, other Linux distributions, etc. This would be very helpful to be documents and verified to work. As this is just a small team of developers, we only have access to so much hardware/software, so if you can help out, please do test things out to the best of your capability!