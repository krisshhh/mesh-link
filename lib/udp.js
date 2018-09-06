'use strict';

const os = require('os');
const networkInterfaces = os.networkInterfaces() || {};
const eth0 = networkInterfaces.eth0 || [];
const dgram = require('dgram');
const logger = require('./logger');

const E_PORT_IN_USE = 'EADDRINUSE';

const conf = {
    addr: eth0[0] || '127.0.0.1',
    port: 8100
};

var server;

class UdpEngine {

    constructor(addr, port) {
        this._addr = addr || conf.addr;
        this._port = port || conf.port;
        this._server = null;
        this._onMessageListeners = [];
    }

    start() {
        var bind = { that: this };
        return new Promise(this._start.bind(null, bind));
    }

    stop() {
        if (this._server) {
            this._server.close();
            this._server = null;
        }
    }

    info() {
        return { address: this._addr, port: this._port };
    }

    send(addr, port, buf) {
        if (!this._server) {
            return;
        }
        this._server.send(buf, 0, buf.length, port, addr);
    }

    receive(listener) {
        this._onMessageListeners.push(listener);   
    }

    _start(bind, resolve, reject) {
        var that = bind.that;
        var bind2 = { that: that, resolve: resolve, reject: reject };
        that._server = dgram.createSocket('udp4');
        that._server.on('listening', that._onListening.bind(null, bind2));
        that._server.on('error', that._onError.bind(null, bind2));
        that._server.on('message', that._onMessage.bind(null, { that: that }));
        that._server.bind({
            port: that._port,
            address: that._addr,
            exclusive: true
        });
    }

    _onListening(bind) {
        var that = bind.that;
        var info = that._server.address();
        that._addr = info.address;
        that._port = info.port;
        logger.info('Mesh network is ready at', that._addr, that._port);
        bind.resolve();
    }

    _onError(bind, error) {
        if (error.code === E_PORT_IN_USE) {
            bind.that._port += 1;
            bind.that.stop();
            bind.that._start(bind, bind.resolve, bind.reject);
            return;
        }
        bind.reject(error);
    }

    _onMessage(bind, buf, remote) {
        var listeners = bind.that._onMessageListeners;
        for (var i = 0, len = listeners.length; i < len; i++) {
            listeners[i](buf, remote);
        }
    }

}

module.exports = UdpEngine;
