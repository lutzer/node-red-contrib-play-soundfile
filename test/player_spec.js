const should = require('should')
const sinon = require('sinon')
const path = require('path')
const { EventEmitter } = require('events')
const childProcess = require('child_process')

const TEST_WAV = path.join(__dirname, 'fixtures', 'test.wav')
const playerPath = require.resolve('../player')

describe('player module', function () {

  describe('play() with stubbed spawn', function () {
    let spawnStub
    let mockProc
    let player

    beforeEach(function () {
      mockProc = new EventEmitter()
      mockProc.kill = sinon.stub()
      // Stub spawn BEFORE requiring player, since player destructures spawn at load time
      spawnStub = sinon.stub(childProcess, 'spawn').returns(mockProc)
      delete require.cache[playerPath]
      player = require('../player')
    })

    afterEach(function () {
      sinon.restore()
      delete require.cache[playerPath]
    })

    it('should spawn afplay on macOS with correct filepath', function () {
      if (process.platform !== 'darwin') return this.skip()

      player.play('/some/file.wav')
      spawnStub.calledOnce.should.be.true()
      spawnStub.firstCall.args[0].should.equal('afplay')
      spawnStub.firstCall.args[1].should.containEql('/some/file.wav')
    })

    it('should pass volume option as -v flag on macOS', function () {
      if (process.platform !== 'darwin') return this.skip()

      player.play('/some/file.wav', { volume: 0.5 })
      spawnStub.calledOnce.should.be.true()
      const args = spawnStub.firstCall.args[1]
      args.should.containEql('-v')
      args.should.containEql('0.5')
    })

    it('should return an object with a kill method', function () {
      const proc = player.play('/some/file.wav')
      proc.should.have.property('kill')
      ;(typeof proc.kill).should.equal('function')
    })

    it('should call callback with null on successful exit (code 0)', function (done) {
      player.play('/some/file.wav', {}, function (err) {
        should(err).be.null()
        done()
      })
      mockProc.emit('close', 0)
    })

    it('should call callback with null on exit code null (killed)', function (done) {
      player.play('/some/file.wav', {}, function (err) {
        should(err).be.null()
        done()
      })
      mockProc.emit('close', null)
    })

    it('should call callback with error on non-zero exit code', function (done) {
      player.play('/some/file.wav', {}, function (err) {
        err.should.be.an.Error()
        err.message.should.match(/exited with code/)
        done()
      })
      mockProc.emit('close', 1)
    })

    it('should call callback with error on process error event', function (done) {
      const testError = new Error('spawn failed')
      player.play('/some/file.wav', {}, function (err) {
        err.should.equal(testError)
        done()
      })
      mockProc.emit('error', testError)
    })

    it('should handle options parameter being omitted', function (done) {
      player.play('/some/file.wav', function (err) {
        should(err).be.null()
        done()
      })
      mockProc.emit('close', 0)
    })

    it('should not throw when callback is omitted', function () {
      const proc = player.play('/some/file.wav')
      mockProc.emit('close', 0)
      proc.should.be.ok()
    })
  })

  describe('play() with real audio file (integration)', function () {
    let player

    before(function () {
      // Ensure we have a fresh, un-stubbed player module
      delete require.cache[playerPath]
      player = require('../player')
    })

    it('should play test.wav without error', function (done) {
      this.timeout(5000)
      const proc = player.play(TEST_WAV, function (err) {
        should(err).be.null()
        done()
      })
      proc.should.have.property('kill')
    })

    it('should be killable mid-playback', function (done) {
      this.timeout(5000)
      const proc = player.play(TEST_WAV, function (err) {
        // After kill, callback fires with null (exit code null) or error
        done()
      })
      setTimeout(function () {
        proc.kill()
      }, 100)
    })
  })
})
