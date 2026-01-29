const { spawn, execSync } = require('child_process')
const path = require('path')

function findLinuxPlayer() {
  const players = [
    { cmd: 'aplay', args: (f) => [f] },
    { cmd: 'mpg123', args: (f) => [f] },
    { cmd: 'mpg321', args: (f) => [f] },
    { cmd: 'play', args: (f) => [f] },
    { cmd: 'mplayer', args: (f) => [f] },
    { cmd: 'omxplayer', args: (f) => [f] },
    { cmd: 'cvlc', args: (f) => ['--play-and-exit', f] }
  ]

  for (const player of players) {
    try {
      execSync(`which ${player.cmd}`, { stdio: 'ignore' })
      return player
    } catch (e) {
      // not found, try next
    }
  }
  return null
}

function play(filepath, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  options = options || {}
  callback = callback || function () {}

  const platform = process.platform
  let proc

  if (platform === 'darwin') {
    const args = [filepath]
    if (options.volume !== undefined) {
      args.push('-v', String(options.volume))
    }
    proc = spawn('afplay', args)
  } else if (platform === 'win32') {
    const escapedPath = filepath.replace(/'/g, "''")
    const script = `
      Add-Type -AssemblyName presentationCore
      $player = New-Object System.Windows.Media.MediaPlayer
      $player.Open([uri]'${escapedPath}')
      $player.Play()
      Start-Sleep -Milliseconds 500
      while ($player.Position -lt $player.NaturalDuration.TimeSpan) {
        Start-Sleep -Milliseconds 100
      }
      $player.Stop()
      $player.Close()
    `
    proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script])
  } else {
    // Linux / other
    const player = findLinuxPlayer()
    if (!player) {
      const err = new Error(
        'No audio player found. Please install one of: aplay, mpg123, mpg321, play (sox), mplayer, omxplayer, or cvlc'
      )
      process.nextTick(() => callback(err))
      // Return a dummy object with a kill method for API compatibility
      return { kill: function () {} }
    }
    proc = spawn(player.cmd, player.args(filepath))
  }

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      callback(new Error(`Player exited with code ${code}`))
    } else {
      callback(null)
    }
  })

  proc.on('error', (err) => {
    callback(err)
  })

  return proc
}

module.exports = { play }
