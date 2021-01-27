const path = require('path')
const player = require('play-sound')(opts = {})

module.exports = function(RED) {
  function PlaySoundfileNode(config) {
    RED.nodes.createNode(this, config)
      let node = this
      let configNode = RED.nodes.getNode(config.directory)
      let playback = null

      node.on('input', function(msg) {
        
        // stop playback
        if (msg.topic == "stop" && playback) {
          playback.kill()
          return;
        } else if (playback) {
          return
        }

        node.status({ fill: "green", shape: "dot", text: "playing"})

        // start playback
        let filePath = path.normalize(path.join('/' + configNode.directory + '/' + (msg.file || config.file) ))
        playback = player.play(filePath, function(err){
          node.status({})
          playback = null
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

  RED.nodes.registerType("soundfile-directory", ConfigSoundfilerNode);
}