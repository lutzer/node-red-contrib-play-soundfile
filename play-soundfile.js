const path = require('path')
const player = require('play-sound')(opts = {})

module.exports = function(RED) {
  function PlaySoundfileNode(config) {
    RED.nodes.createNode(this, config)
      let node = this
      let configNode = RED.nodes.getNode(config.directory)

      node.on('input', function(msg) {
        let filePath = path.normalize(path.join('/' + configNode.directory + '/' + (msg.file || config.file) ))

        player.play(filePath, function(err){
          if (err) node.error(`Error playing back file ${filePath}`, msg)
          else node.send(msg)
        })
      });
  }

  RED.nodes.registerType("play-soundfile", PlaySoundfileNode)

  function ConfigSoundfilerNode(config) {
    RED.nodes.createNode(this,config)
    this.directory = config.directory
  }

  RED.nodes.registerType("config-soundfile", ConfigSoundfilerNode);
}