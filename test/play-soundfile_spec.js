const should = require('should')
const sinon = require('sinon')
const path = require('path')
const helper = require('node-red-node-test-helper')
const playSoundfileNode = require('../play-soundfile.js')
const player = require('../player')

const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const TEST_WAV = 'test.wav'

helper.init(require.resolve('node-red'))

describe('play-soundfile Node', function () {
  let playStub

  beforeEach(function (done) {
    helper.startServer(done)
  })

  afterEach(function (done) {
    if (playStub) {
      playStub.restore()
      playStub = null
    }
    helper.unload().then(function () {
      helper.stopServer(done)
    })
  })

  function stubPlayer(exitCode) {
    const fakeProc = { kill: sinon.stub() }
    playStub = sinon.stub(player, 'play').callsFake(function (filepath, options, cb) {
      if (typeof options === 'function') {
        cb = options
      }
      if (exitCode === 0) {
        process.nextTick(function () { cb(null) })
      } else if (exitCode instanceof Error) {
        process.nextTick(function () { cb(exitCode) })
      }
      // If exitCode is undefined, don't call cb (simulates ongoing playback)
      return fakeProc
    })
    return fakeProc
  }

  function makeFlow(overrides) {
    overrides = overrides || {}
    return [
      {
        id: 'dir1',
        type: 'soundfile-directory',
        directory: overrides.directory || FIXTURES_DIR
      },
      {
        id: 'n1',
        type: 'play-soundfile',
        name: overrides.name || 'test-node',
        directory: 'dir1',
        file: overrides.file || TEST_WAV,
        options: overrides.options || '{}',
        allow_multiple: overrides.allow_multiple || false,
        wires: [['n2']]
      },
      { id: 'n2', type: 'helper' }
    ]
  }

  describe('node loading', function () {
    it('should register the play-soundfile node type', function (done) {
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        n1.should.have.property('type', 'play-soundfile')
        done()
      })
    })

    it('should register the soundfile-directory config node type', function (done) {
      helper.load(playSoundfileNode, makeFlow(), function () {
        const dir = helper.getNode('dir1')
        dir.should.have.property('type', 'soundfile-directory')
        done()
      })
    })

    it('should load with correct name property', function (done) {
      helper.load(playSoundfileNode, makeFlow({ name: 'my-sound' }), function () {
        const n1 = helper.getNode('n1')
        n1.should.have.property('name', 'my-sound')
        done()
      })
    })
  })

  describe('config node', function () {
    it('should store the directory property', function (done) {
      helper.load(playSoundfileNode, makeFlow({ directory: '/custom/path' }), function () {
        const dir = helper.getNode('dir1')
        dir.should.have.property('directory', '/custom/path')
        done()
      })
    })
  })

  describe('playback', function () {
    it('should call player.play with correct file path', function (done) {
      stubPlayer(0)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        n1.receive({ payload: 'go', _msgid: 'msg1' })
        setTimeout(function () {
          playStub.calledOnce.should.be.true()
          const filepath = playStub.firstCall.args[0]
          filepath.should.equal(path.normalize(path.join(FIXTURES_DIR, TEST_WAV)))
          done()
        }, 50)
      })
    })

    it('should send the original message to output after playback completes', function (done) {
      stubPlayer(0)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        const n2 = helper.getNode('n2')
        n2.on('input', function (msg) {
          msg.should.have.property('payload', 'test-data')
          done()
        })
        n1.receive({ payload: 'test-data', _msgid: 'msg1' })
      })
    })

    it('should set node status to playing when playback starts', function (done) {
      stubPlayer(undefined) // Don't complete playback
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        n1.on('call:status', function (call) {
          call.args[0].should.have.property('text', 'playing')
          call.args[0].should.have.property('fill', 'green')
          done()
        })
        n1.receive({ payload: 'go', _msgid: 'msg1' })
      })
    })

    it('should clear node status after playback completes', function (done) {
      stubPlayer(0)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        let statusCalls = []
        n1.on('call:status', function (call) {
          statusCalls.push(call.args[0])
        })
        n1.receive({ payload: 'go', _msgid: 'msg1' })
        setTimeout(function () {
          // Last status call should be empty (cleared)
          const lastStatus = statusCalls[statusCalls.length - 1]
          lastStatus.should.deepEqual({})
          done()
        }, 100)
      })
    })

    it('should error with file not found when file does not exist', function (done) {
      stubPlayer(0)
      helper.load(playSoundfileNode, makeFlow({ file: 'nonexistent.wav' }), function () {
        const n1 = helper.getNode('n1')
        n1.on('call:error', function (call) {
          call.args[0].should.match(/File not found/)
          call.args[0].should.match(/nonexistent\.wav/)
          done()
        })
        n1.receive({ payload: 'go', _msgid: 'msg1' })
      })
    })

    it('should not call player.play when file does not exist', function (done) {
      stubPlayer(0)
      helper.load(playSoundfileNode, makeFlow({ file: 'nonexistent.wav' }), function () {
        const n1 = helper.getNode('n1')
        n1.receive({ payload: 'go', _msgid: 'msg1' })
        setTimeout(function () {
          playStub.callCount.should.equal(0)
          done()
        }, 50)
      })
    })

    it('should report error via node.error when playback fails', function (done) {
      const testErr = new Error('playback failed')
      stubPlayer(testErr)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        n1.on('call:error', function (call) {
          call.args[0].should.match(/Error playing back file/)
          done()
        })
        n1.receive({ payload: 'go', _msgid: 'msg1' })
      })
    })
  })

  describe('stop command', function () {
    it('should kill all active playbacks when msg.topic is stop', function (done) {
      const fakeProc = stubPlayer(undefined) // Ongoing playback
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        // Start a playback
        n1.receive({ payload: 'go', _msgid: 'msg1' })
        setTimeout(function () {
          // Send stop
          n1.receive({ topic: 'stop', _msgid: 'msg2' })
          setTimeout(function () {
            fakeProc.kill.calledOnce.should.be.true()
            done()
          }, 50)
        }, 50)
      })
    })

    it('should clear node status after stop', function (done) {
      stubPlayer(undefined)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        n1.receive({ payload: 'go', _msgid: 'msg1' })
        setTimeout(function () {
          let statusCleared = false
          n1.on('call:status', function (call) {
            if (Object.keys(call.args[0]).length === 0) {
              statusCleared = true
            }
          })
          n1.receive({ topic: 'stop', _msgid: 'msg2' })
          setTimeout(function () {
            statusCleared.should.be.true()
            done()
          }, 50)
        }, 50)
      })
    })
  })

  describe('multiple playbacks', function () {
    it('should ignore new messages when playback active and allow_multiple is false', function (done) {
      stubPlayer(undefined)
      helper.load(playSoundfileNode, makeFlow({ allow_multiple: false }), function () {
        const n1 = helper.getNode('n1')
        n1.receive({ payload: 'first', _msgid: 'msg1' })
        setTimeout(function () {
          n1.receive({ payload: 'second', _msgid: 'msg2' })
          setTimeout(function () {
            // player.play should only be called once
            playStub.callCount.should.equal(1)
            done()
          }, 50)
        }, 50)
      })
    })

    it('should allow concurrent playbacks when allow_multiple is true', function (done) {
      stubPlayer(undefined)
      helper.load(playSoundfileNode, makeFlow({ allow_multiple: true }), function () {
        const n1 = helper.getNode('n1')
        n1.receive({ payload: 'first', _msgid: 'msg1' })
        setTimeout(function () {
          n1.receive({ payload: 'second', _msgid: 'msg2' })
          setTimeout(function () {
            playStub.callCount.should.equal(2)
            done()
          }, 50)
        }, 50)
      })
    })
  })

  describe('message overrides', function () {
    it('should use msg.file to override configured file', function (done) {
      stubPlayer(0)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        // other.wav doesn't exist, so the file-not-found error should contain the overridden path
        n1.on('call:error', function (call) {
          call.args[0].should.match(/other\.wav/)
          done()
        })
        n1.receive({ file: 'other.wav', _msgid: 'msg1' })
      })
    })

    it('should use msg.directory to override configured directory', function (done) {
      stubPlayer(0)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        // /other/dir doesn't exist, so the file-not-found error should contain the overridden directory
        n1.on('call:error', function (call) {
          call.args[0].should.match(/\/other\/dir/)
          done()
        })
        n1.receive({ directory: '/other/dir', _msgid: 'msg1' })
      })
    })
  })

  describe('node close/cleanup', function () {
    it('should kill all active playbacks on node close', function (done) {
      const fakeProc = stubPlayer(undefined)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        n1.receive({ payload: 'go', _msgid: 'msg1' })
        setTimeout(function () {
          n1.close().then(function () {
            fakeProc.kill.calledOnce.should.be.true()
            done()
          })
        }, 50)
      })
    })
  })

  describe('integration test with real audio', function () {
    it('should play test.wav end-to-end and send msg to output', function (done) {
      this.timeout(10000)
      helper.load(playSoundfileNode, makeFlow(), function () {
        const n1 = helper.getNode('n1')
        const n2 = helper.getNode('n2')
        n2.on('input', function (msg) {
          msg.should.have.property('payload', 'integration-test')
          done()
        })
        n1.receive({ payload: 'integration-test', _msgid: 'int1' })
      })
    })
  })
})
