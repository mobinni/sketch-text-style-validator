'use strict'

var fs = require('fs')

exports.pathExists = function pathExists(filePath) {
  var fn = typeof fs.access === 'function' ? fs.accessSync : fs.statSync

  try {
    fn(filePath)
    return true
  } catch (e) {
    return false
  }
}

exports.filterFilesInDirByExtension = function filterFilesInDirByExtension(directory, extension) {
  var dirFiles = fs.readdirSync(directory)
  var extensionRegExp = new RegExp(extension + '$')

  return dirFiles.filter(function(file) {
    return extensionRegExp.test(file)
  })
}
