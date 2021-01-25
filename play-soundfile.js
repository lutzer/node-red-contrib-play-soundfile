const path = require('path')

module.exports = function(RED) {
  function PlaySoundfileNode(config) {
    RED.nodes.createNode(this, config)
      let node = this
      let configNode = RED.nodes.getNode(config.directory)

      node.on('input', function(msg) {
        let filePath = path.normalize(path.join('/' + configNode.directory + '/' + config.file))
        msg.payload = filePath
        node.send(msg)
      });
  }

  RED.nodes.registerType("play-soundfile", PlaySoundfileNode)

  function ConfigSoundfilerNode(config) {
    RED.nodes.createNode(this,config)
    this.directory = config.directory
  }

  RED.nodes.registerType("config-soundfile", ConfigSoundfilerNode);
}