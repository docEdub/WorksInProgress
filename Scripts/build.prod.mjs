import * as child_process from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as config from './.config.mjs'

if (os.type() === 'Darwin') {
    // Build projects in Projects folder.
    child_process.spawnSync('bash', [ '-c', 'node build.prod.mjs' ], { cwd: config.projectsDir, stdio: 'inherit' });

    // Copy project app folders to blog source static folder.
    const separator = '\n--------------------------------------------------------------------------------------------\n'
    console.log('Copying project app folders to blog static folder ...')
    const projects = fs.readdirSync(config.projectsDir).filter(
        item => fs.statSync(path.join(config.projectsDir, item)).isDirectory())
    projects.forEach((project) => {
        const projectBuildPath = path.join(config.projectsDir, project, 'app')
        console.log(separator)
        if (fs.existsSync(projectBuildPath)) {
            const projectNumber = project.split('-')[0]
            const blogStaticPath = path.join(config.blogSourceDir, 'static', projectNumber)
            console.log(projectBuildPath, '->', blogStaticPath)
            if (!fs.existsSync(blogStaticPath)) {
                fs.mkdirSync(blogStaticPath)
                fs.copyFileSync(path.join(projectBuildPath, 'app.js'), path.join(blogStaticPath, 'app.js'))
                fs.copyFileSync(path.join(projectBuildPath, 'index.html'), path.join(blogStaticPath, 'index.html'))
            }
        }
        else {
            console.log('No app folder found.')
        }
    })
    console.log(separator)

    // Build blog.
    if (!fs.existsSync(path.join(config.blogSourceDir, 'node_modules'))) {
        child_process.spawnSync('bash', [ '-c', 'npm install' ], { cwd: config.blogSourceDir, stdio: 'inherit' })
    }
    child_process.spawnSync('bash', [ '-c', 'npm run build:prod' ], { cwd: config.blogSourceDir, stdio: 'inherit' })

    // Copy blog build to Blog-build folder.
    const sourceDir = path.join(config.blogSourceDir, '.build.prod')
    child_process.spawnSync('bash', [ '-c', 'cp -r ' + sourceDir + '/* ' + config.blogBuildDir ], { stdio: 'inherit' })
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}
