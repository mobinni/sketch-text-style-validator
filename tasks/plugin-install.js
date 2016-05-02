'use strict'

var path = require('path')
var fs = require('fs-extra')
var inquirer = require('inquirer')
var Promise = require('bluebird')
var _ = require('lodash')
var homedir = require('homedir')
var pathExists = require('./lib/utils').pathExists
var filterFilesInDirByExtension = require('./lib/utils').filterFilesInDirByExtension
var message = require('./lib/message')(process.argv[1])

var messages = {
  start: 'Starting process...',
  description: ' will be copied in all available Sketch Plugins folders',
  empty: 'No Sketch Plugins folder found, ensure that Sketch is installed',
  copied: ' copied successfully in all available Sketch Plugins folders',
  aborted: 'Aborted'
}

var pluginsFolderPaths = {
  sandboxed: path.join(homedir(), 'Library/Containers/com.bohemiancoding.sketch3/Data/Library/Application Support/com.bohemiancoding.sketch3/Plugins'),
  nonSandboxed: path.join(homedir(), 'Library/Application Support/com.bohemiancoding.sketch3/Plugins'),
  sandboxedBeta: path.join(homedir(), 'Library/Containers/com.bohemiancoding.sketch3.beta/Data/Library/Application Support/com.bohemiancoding.sketch3/Plugins'),
  nonSandboxedBeta: path.join(homedir(), 'Library/Application Support/com.bohemiancoding.sketch3.beta/Plugins')
}

message('INFO', messages.start)

var rootDir = path.resolve(__dirname, '..')
var plugins = filterFilesInDirByExtension(rootDir, '.sketchplugin')

function checkIfFileExistInDirs(file, dirs) {
  for (var i = 0; i < dirs.length; ++i) {
    if (pathExists(path.join(dirs[i], file))) {
      return true
    }
  }
  return false
}

function promptUserForOverwrite() {
  return new Promise(function(resolve) {
    var questions = [{
      type: 'confirm',
      name: 'overwriteFile',
      message: 'Plugin already exists in any of Plugins folder. Do you want to overwrite it?'
    }]
    inquirer.prompt(questions, function(answers) {
      resolve(answers.overwriteFile)
    })
  })
}

function copyPluginsIntoPluginsFolders(plugin, folderPaths) {
  return Promise.each(folderPaths, function(folderPath) {
    var source = path.join(rootDir, plugin)
    var dest = path.join(folderPath, plugin)

    fs.copy(source, dest, {clobber: true}, function(err) {
      if (err) {
        throw err
      }
      return
    })
  })
}

function installPlugin(plugin) {
  var overwriteFileIsNeeded = false
  var pluginsFolderPathsArray = _.values(pluginsFolderPaths)
  var destPaths = pluginsFolderPathsArray.filter(function(folderPaths) {
    return pathExists(folderPaths)
  })

  overwriteFileIsNeeded = checkIfFileExistInDirs(plugin, destPaths)

  if (destPaths.length === 0) {
    return message('WARNING', messages.empty)
  }
  message('INFO', plugin + messages.description)

  return Promise.resolve()
    .then(function() {
      if (overwriteFileIsNeeded) {
        return promptUserForOverwrite()
      }
      return true
    }).then(function(copyFiles) {
      if (copyFiles) {
        return copyPluginsIntoPluginsFolders(plugin, destPaths)
          .then(function() {
            message('SUCCESS', plugin + messages.copied)
          }).catch(function(err) {
            throw err
          })
      }
      message('INFO', messages.aborted)
    }).catch(function(err) {
      throw err
    })
}

plugins.reduce(function(currentPlugin, nextPlugin) {
  return currentPlugin.then(function() {
    return installPlugin(nextPlugin)
  })
}, Promise.resolve())
