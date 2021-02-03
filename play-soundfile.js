const path = require('path')
const player = require('play-sound')(opts = {})

module.exports = function(RED) {

  function getProjectDir() {
    var settings = RED.settings
    var projects = settings ? settings.get('projects') : null
    return projects ? path.join(settings.userDir, '/projects/', projects.activeProject) : ''
  }

  function PlaySoundfileNode(config) {
    RED.nodes.createNode(this, config)
      const node = this
      const configNode = RED.nodes.getNode(config.directory)

      if (!configNode)
        return;

      const directory = path.isAbsolute(configNode.directory) ? configNode.directory : path.join(getProjectDir(), configNode.directory)
      
      var playbacks = []

      node.on('input', function(msg) {
        
        // stop playback
        if (msg.topic == "stop") {
          playbacks.forEach((p) => p.pl.kill())
          playbacks = []
          node.status({})
          return;
        } else if (playbacks.length > 0 && !config.allow_multiple) {
          return
        }

        node.status({ fill: "green", shape: "dot", text: "playing"})

        // start playback
        let filePath = path.normalize(path.join(msg.directory || directory, msg.file || config.file))
        let playback = player.play(filePath, function(err){
          // remove playback
          playbacks = playbacks.filter((p) => p.id != msg._msgid)

          if (playbacks.length == 0) node.status({})

          if (err) node.error(`Error playing back file ${filePath}`, msg)
          else node.send(msg)
        })

        // add playback to playbacks list
        playbacks.push({
          pl : playback,
          id: msg._msgid
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