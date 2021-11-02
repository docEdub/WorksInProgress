import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as child_process from 'child_process'

if (os.type() === 'Darwin') {
    const separator = '\n--------------------------------------------------------------------------------------------\n'
    const cwd = path.resolve('.')
    const projects = fs.readdirSync(cwd).filter(path => fs.statSync(path).isDirectory())
    projects.forEach((project) => {
        const projectPath = path.join(cwd, project)
        console.log(separator)
        console.log(projectPath)
        if (fs.existsSync(path.join(projectPath, 'package.json'))) {
            if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
                child_process.spawnSync('bash', [ '-c', 'npm install' ], { cwd: projectPath, stdio: 'inherit' })
            }
            child_process.spawnSync('bash', [ '-c', 'npm run clean:prod' ], { cwd: projectPath, stdio: 'inherit' })
        }
        else {
            console.log('\n')
            console.log('No package.json found.')
        }
    })
    console.log(separator)
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}

