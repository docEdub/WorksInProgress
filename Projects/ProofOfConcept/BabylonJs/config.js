
const path = require('path')


const _rootPath = path.join(__dirname, '../..')
const _rootOutputPath = path.join(_rootPath, 'dist')
const _rootProjectsPath = path.join(_rootPath, 'Projects')

const _projectName = 'ProofOfConcept'

const _relativeProjectOutputPath = path.join(_projectName)
const _relativeProjectSourcePath = path.join(_projectName, 'BabylonJs')

const _projectOutputPath = path.join(_rootOutputPath, _relativeProjectOutputPath)
const _projectSourcePath = path.join(_rootPath, _relativeProjectSourcePath)

module.exports = {
    projectName: _projectName,

    rootPath: _rootPath,
    rootOutputPath: _rootOutputPath,
    rootProjectsPath: _rootProjectsPath,

    relativeProjectOutputPath: _relativeProjectOutputPath,
    relativeProjectSourcePath: _relativeProjectSourcePath,

    projectOutputPath: _projectOutputPath,
    projectSourcePath: _projectSourcePath,
}
