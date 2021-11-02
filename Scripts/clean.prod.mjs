import * as child_process from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as config from './.config.mjs'

if (os.type() === 'Darwin') {
    
    child_process.spawnSync('bash', [ '-c', 'node clean.prod.mjs' ], { cwd: config.projectsDir, stdio: 'inherit' })

    console.log(config.blogSourceDir)
    if (!fs.existsSync(path.join(config.blogSourceDir, 'node_modules'))) {
        child_process.spawnSync('bash', [ '-c', 'npm install' ], { cwd: config.blogSourceDir, stdio: 'inherit' })
    }
    child_process.spawnSync('bash', [ '-c', 'npm run clean:prod' ], { cwd: config.blogSourceDir, stdio: 'inherit' })

    var deleteFolderRecursive = (path) => {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach((file) => {
                var curPath = path + "/" + file
                if(fs.lstatSync(curPath).isDirectory()) {
                    deleteFolderRecursive(curPath)
                }
                else {
                    fs.unlinkSync(curPath)
                }
            })
            fs.rmdirSync(path)
        }
    }

    const blogBuildFolders = fs.readdirSync(config.blogBuildDir).filter(item => fs.statSync(path.join(config.blogBuildDir, item)).isDirectory())
    blogBuildFolders.forEach((buildFolder) => {
        deleteFolderRecursive(path.join(config.blogBuildDir, buildFolder))
    })

    const blogBuildFiles = fs.readdirSync(config.blogBuildDir).filter(item => fs.statSync(path.join(config.blogBuildDir, item)).isFile())
    blogBuildFiles.forEach((buildFile) => {
        if (buildFile == 'CNAME') {
            return;
        }
        fs.unlinkSync(path.join(config.blogBuildDir, buildFile))
    })
}
else {
    throw new Error('Unsupported OS: ' + os.type())
}
