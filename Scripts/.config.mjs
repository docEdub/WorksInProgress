import * as path from 'path';

const rootDir = path.resolve('..')
const blogBuildDir = path.join(rootDir, 'Blog-build')
const blogSourceDir = path.join(rootDir, 'Blog-source')
const projectsDir = path.join(rootDir, 'Projects')

export {
    rootDir,
    blogBuildDir,
    blogSourceDir,
    projectsDir
}
