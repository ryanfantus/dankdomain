/*****************************************************************************\
 *  Ɗaɳƙ Ɗoɱaiɳ: the return of Hack & Slash                                  *
 *  BOT authored by: Robert Hurst <theflyingape@gmail.com>                   *
\*****************************************************************************/

import dns = require('dns')
import fs = require('fs')
import ws = require('ws')
const got = require('got')

process.title = 'ddbot'
process.chdir(__dirname)

//  process signal traps
process.on('SIGHUP', () => {
  console.log(new Date() + ' :: received hangup')
})

process.on('SIGINT', () => {
  console.log(new Date() + ' :: received interrupt')
  process.exit()
})

process.on('SIGQUIT', () => {
  console.log(new Date() + ' :: received quit')
  process.exit()
})

process.on('SIGTERM', () => {
  console.log(new Date() + ' :: received terminate')
  process.exit()
})

process.on('uncaughtException', (err, origin) => {
  console.log(`${origin} ${err}`)
})

module Bot {

  export let output = ''
  let host = 'localhost'
  let port = 1939
  let URL, ssl

  try {
    ssl = {
      key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem'),
      requestCert: false, rejectUnauthorized: false
    }
    URL = `https://${host}:${port}/player/`
  }
  catch (err) {
    console.log(err.message)
    console.log(`\r\n
# you might consider generating a self-signed key in: ${__dirname}\r\n
$ openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem \\\r\n
  -subj "/C=US/ST=Rhode Island/L=Providence/O=Dank Domain/OU=Game/CN=localhost"\r\n`)
    URL = `http://${host}:${port}/player/`
  }

  if (process.stdin.isTTY) process.stdin.setRawMode(true)

  dns.lookup(host, (err, addr, family) => {
    if (err) console.log(err)
    else {
      process.stdout.write(`\r\n\x1B[mRequesting ${URL}\r\n  to start new DD client ... `)
      const app = new Promise<number>((resolve, reject) => {
        if (resolve)
          try {
            got(URL + `?rows=25&tty=VT`, { method: 'POST', headers: { 'x-forwarded-for': process.env.REMOTEHOST || process.env.HOSTNAME }, https: ssl })
              .then(response => {
                resolve(response.body)
              }).catch(err => {
                if (err.statusCode)
                  console.log(err.statusCode, err.statusMessage)
                else
                  console.log(err.name, err.code)
                process.exit()
              })
          }
          catch (err) {
            console.log(err.response)
            reject(0)
          }
      })

      app.then(pid => {
        process.stdout.write(`app ${pid} started\r\n`)
        process.stdout.write(`\n\x1B[0;2mConnecting terminal WebSocket (${addr}:${port}) ... `)

        try {
          const wss = new ws(URL + `?pid=${pid}`, ssl)

          wss.onmessage = (ev) => {
            let data = ev.data.toString('ascii')
            let copy = data + ''
            // find any occurrences of @func(data), and for each: call func(data)
            const re = '[@](?:(action|animated|profile|play|title|tune|wall)[(](.+?)[)])'
            let search = new RegExp(re, 'g'); let replace = new RegExp(re)
            let match: RegExpMatchArray
            while (match = search.exec(copy)) {
              let x = replace.exec(data)
              let s = x.index, e = s + x[0].length
              data = data.substr(0, s) + data.substr(e)
              eval(`${match[1]}(match[2])`)
            }
            //process.stdout.write(data)
            output += data

            function action(menu) { }
            function animated(effect) { }
            function play(fileName) { }
            function profile(panel) { }
            function title(name) { }
            function tune(fileName) { }
            function wall(msg) {
              try {
                got(`${URL}${pid}/wall?msg=${msg}`, Object.assign({ method: 'POST', headers: { 'x-forwarded-for': process.env.REMOTEHOST || process.env.HOSTNAME } }, ssl))
              }
              catch (err) {
                console.log(err.response)
              }
            }
          }

          wss.onopen = () => {
            process.stdout.write('open\x1B[m\r\n')
          }

          wss.onclose = (ev) => {
            process.stdout.write('\x1B[0;2mWebSocket close\x1B[m\r\n')
            process.exit(0)
          }

          wss.onerror = (ev) => {
            process.stdout.write(`\x1B[0;1;31merror \x1B[m${ev.message}\r\n`)
            process.exit(1)
          }
          /*
          process.stdin.on('data', function (key: Buffer) {
            wss.send(key)
          })
          */
        }
        catch (err) {
          process.stdout.write(err)
        }
      }).catch(err => {
        process.stdout.write(err)
      })
    }
  })
}

export = Bot
