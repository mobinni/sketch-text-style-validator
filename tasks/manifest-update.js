'use strict'

var fs = require('fs')
var path = require('path')
var message = require('./lib/message')(process.argv[1])
var filterFilesInDirByExtension = require('./lib/utils').filterFilesInDirByExtension

var messages = {
  start: 'Starting process...',
  parseError: '. Unable to parse file. There should be an error in its JSON syntax.',
  noManifest: 'There\'s no manifest file into this plugin folder',
  manifestCreated: 'Updated manifest in '
}

var rootDir = path.resolve(__dirname, '..')
var plugins = filterFilesInDirByExtension(rootDir, '.sketchplugin')
var errorMessages = []
var regex = {
  pluginScript: /.cocoascript$/,
  commandHandler: /\/\*\*[\s\S]*?\*\/[\n\s]+(?:var\s+(on.*?)\s*=\s*function\(context\))/g,
  shortcutLine: /(?:@shortcut\s+)(.*?)\n/,
  shortcutValidation: /^(?:(?!(?:.*ctrl){2})(?!(?:.*cmd){2})(?!(?:.*shift){2})(ctrl|cmd|shift)\s)*[a-z0-9]$/
}

function getManifest(pluginDir) {
  try {
    return require(path.join(pluginDir, 'manifest.json'))
  } catch (e) {
    message('ERROR', path.join(pluginDir, 'manifest.json') + message.parseError)
    process.exit(1)
  }
}

function getCommandNameFromHandler(handler) {
  return handler
    .substr(2)
    .replace(/WithArguments/, '…')
    .replace(/([a-z](?=[A-Z0-9]))/g, '$1 ')
}

function reportErrorInShortcut(shortcut, handler, script) {
  var messageInfo = ['`', shortcut, '` is not a valid shortcut for `', handler, '` handler in `', script, '` file'].join('')
  errorMessages.push(messageInfo)
}

function checkForValidShortcut(regExpMatch, script) {
  var shortcutMatch = regex.shortcutLine.exec(regExpMatch[0])

  if (shortcutMatch) {
    var shortcut = shortcutMatch[1]

    if (regex.shortcutValidation.test(shortcut)) {
      return shortcut
    }

    reportErrorInShortcut(shortcut, regExpMatch[1], script)
  }
}

function writeManifestFile(directory, input) {
  var outputPath = path.join(directory, 'manifest.json')
  if (errorMessages.length === 0) {
    fs.writeFile(outputPath, JSON.stringify(input, null, '  '), function(err) {
      if (err) {
        message('ERROR', err)
      }

      message('SUCCESS', messages.manifestCreated + outputPath)
    })
  } else {
    errorMessages.forEach(function(msg) {
      message('ERROR', msg)
    })
  }
}

message('INFO', messages.start)

plugins.forEach(function(plugin) {
  var pluginDir = path.resolve(__dirname, '../' + plugin + '/Contents/Sketch')
  var pluginFiles = fs.readdirSync(pluginDir)

  if (pluginFiles.indexOf('manifest.json') !== -1) {
    var manifest = getManifest(pluginDir)
    manifest.commands = []
    if (manifest.menu) {
      manifest.menu.items = []
    } else {
      manifest.menu = {
        isRoot: true,
        items: []
      }
    }

    var scripts = filterFilesInDirByExtension(pluginDir, '.cocoascript')

    scripts.forEach(function(script, index) {
      var scriptMenuItem = {
        title: script.replace('.cocoascript', ''),
        items: []
      }

      fs.readFile(path.join(pluginDir, script), function(err, data) {
        if (err) {
          throw err
        }

        var match
        do {
          match = regex.commandHandler.exec(data)
          if (match) {
            var commandHandler = match[1]
            var commandName = getCommandNameFromHandler(commandHandler)
            var pluginCmd = {
              name: commandName,
              identifier: commandName.replace(/ /g, '').toLowerCase(),
              shortcut: checkForValidShortcut(match, script) || '',
              handler: commandHandler,
              script: script
            }

            manifest.commands.push(pluginCmd)
            scriptMenuItem.items.push(pluginCmd.identifier)
          }
        } while (match)

        manifest.menu.isRoot = true
        manifest.menu.items.push(scriptMenuItem)

        if (index === scripts.length - 1) {
          writeManifestFile(pluginDir, manifest)
        }
      })
    })
  } else {
    message('ERROR', messages.noManifest)
  }
})
