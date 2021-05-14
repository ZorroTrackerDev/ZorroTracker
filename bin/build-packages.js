const fs = require("fs");
const resolve = require("path").resolve;
const join = require("path").join;
const cp = require("child_process");
const os = require("os");

const paths = ["../src/scripts/chips", "../src/scripts/drivers", ];

for (const path of paths) {
    const dir = resolve(__dirname, path);

    fs.readdirSync(dir).forEach(function(mod) {
        const modPath = join(dir, mod);

        // ensure path has package.json
        if (!fs.existsSync(join(modPath, "package.json"))) {
            return;
        }

        // npm binary based on OS
        const npmCmd = os.platform().startsWith("win") ? "npm.cmd" : "npm";

        const install = cp.spawn(npmCmd, ["install", ], {
            env: process.env,
            cwd: modPath,
            stdio: "inherit",
        });

        install.on("exit", () => {
            cp.spawn(npmCmd, ["run", "build", ], {
                env: process.env,
                cwd: modPath,
                stdio: "inherit",
            });
        })
    })
}
