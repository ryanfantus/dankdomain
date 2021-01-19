/*****************************************************************************\
 *  Ɗanƙ Ɗomaiƞ: the return of Hack & Slash                                  *
 *  SYS authored by: Robert Hurst <theflyingape@gmail.com>                   *
\*****************************************************************************/

import xvt from '@theflyingape/xvt'
import Got from 'got'
import { sprintf as sf } from 'sprintf-js'
import { titleCase } from 'title-case'

//  global runtime variables
import $ = require('./runtime')
import { dice, int, pathTo } from './lib'
import { Ring } from './items'

module sys {

    //  dependencies with nice aliases
    export const fs = require('fs')
    export const got = Got
    export const romanize = require('romanize')
    export const sprintf = sf
    export const titlecase = titleCase

    export const NEWS = pathTo('files/tavern')
    if (!fs.existsSync(NEWS)) fs.mkdirSync(NEWS)

    export const LOG = pathTo('files/user')
    if (!fs.existsSync(LOG)) fs.mkdirSync(LOG)

    export function an(item: string, show = true) {
        return ' ' + (/a|e|i|o|u/i.test(item[0]) ? 'an' : 'a') + ' ' + (show ? item : '')
    }

    export function armor(profile = $.online, text = false): string {
        return text ? profile.user.armor + buff(profile.user.toAC, profile.toAC, true)
            : vt.attr(profile.armor.armoury ? vt.white : profile.armor.dwarf ? vt.yellow : vt.lcyan
                , profile.user.armor, vt.white, buff(profile.user.toAC, profile.toAC))
    }

    export function beep() {
        if (vt.emulation == 'XT')
            vt.sound('max')
        else
            vt.out('\x07', -100)
    }

    export function bracket(item: string | number, nl = true): string {
        const s = item.toString()
        let framed = vt.attr(vt.reset, nl ? '\n' : '')
        if (typeof item == 'number' && item < 10)
            framed += ' '
        framed += vt.attr(vt.faint, '<', vt.bright, s, vt.faint, '>', nl ? ' ' : '', vt.reset)
        return framed
    }

    export function buff(perm: number, temp: number, text = false): string {
        let keep = vt.emulation
        if (text) vt.emulation = 'dumb'
        let buff = ''
        if (perm || temp) {
            buff = vt.attr(vt.normal, vt.magenta, ' (')
            if (perm > 0) buff += vt.attr(vt.bright, vt.yellow, '+', perm.toString(), vt.normal, vt.white)
            else if (perm < 0) buff += vt.attr(vt.bright, vt.red, perm.toString(), vt.normal, vt.white)
            else buff += vt.attr(vt.white, '+0')
            if (temp) buff += vt.attr(','
                , (temp > 0) ? vt.attr(vt.yellow, vt.bright, '+', temp.toString())
                    : vt.attr(vt.red, vt.bright, temp.toString())
                , vt.normal)
            buff += vt.attr(vt.magenta, ')', vt.white)
        }
        if (text) vt.emulation = keep
        return buff
    }

    export function cat(name: string): boolean {
        const file = pathTo('files', name)
        let filename = file + (vt.emulation == 'PC' ? '.ibm' : vt.emulation == 'XT' ? '.ans' : '.txt')
        try {
            fs.accessSync(filename, fs.constants.F_OK)
            vt.outln(fs.readFileSync(filename, vt.emulation == 'XT' ? 'utf8' : 'binary'))
            return true
        } catch (e) {
            if (vt.emulation.match('PC|XT')) {
                filename = file + '.txt'
                try {
                    fs.accessSync(filename, fs.constants.F_OK)
                    vt.outln(fs.readFileSync(filename))
                    return true
                } catch (e) {
                    return false
                }
            }
        }
    }

    export function checkTime(): number {
        return Math.round((vt.sessionAllowed - ((new Date().getTime() - vt.sessionStart.getTime()) / 1000)) / 60)
    }

    export function cuss(text: string): boolean {
        let words = titlecase(text).split(' ')

        for (let i in words) {
            if (words[i].match('/^Asshole$|^Cock$|^Cunt$|^Fck$|^Fu$|^Fuc$|^Fuck$|^Fuk$|^Phuc$|^Phuck$|^Phuk$|^Twat$/')) {
                vt.reason = 'needs a timeout'
                return true
            }
        }
        return false
    }

    export function death(by: string, killed = false) {
        $.reason = by
        vt.profile({ handle: `💀 ${$.reason} 💀`, png: `death${$.player.today}`, effect: 'fadeInDownBig' })
        if (killed) {
            $.online.hp = 0
            $.online.sp = 0
            $.player.killed++
            vt.sound('killed', 11)
        }
        $.online.altered = true
    }

    //  render a menu of options and return the prompt
    export function display(title: string, back: number, fore: number, suppress: boolean, menu: choices, hint?: string): string {
        menu['Q'] = {}  //  Q=Quit
        if (!suppress) {
            vt.cls()
            if (!cat(`${title}/menu`)) {
                vt.out('    ')
                if (back)
                    vt.out(fore, '--=:))', vt.LGradient,
                        back, vt.white, vt.bright, titlecase(title), vt.reset,
                        fore, vt.RGradient, '((:=--')
                else
                    vt.out(titlecase(title))
                vt.outln('\n')
                for (let i in menu) {
                    if (menu[i].description)
                        vt.outln(vt.faint, fore, '<', vt.white, vt.bright, i, vt.faint, fore, '> ',
                            vt.reset, menu[i].description)
                }
            }
            else {
                if (title == 'main') cat('border')
            }
        }

        if (process.stdout.rows && process.stdout.rows !== $.player.rows) {
            if (!$.player.expert) vt.out('\n', vt.yellow, vt.Empty, vt.bright
                , `Resetting your USER ROW setting (${$.player.rows}) to detected size ${process.stdout.rows}`
                , vt.reset)
            $.player.rows = process.stdout.rows
        }

        if (hint && $.access.roleplay && dice(+$.player.expert * ($.player.immortal + 1) + $.player.level / 10) == 1)
            vt.out('\n', vt.green, vt.bright, hint, vt.reset)

        //  insert any wall messages here
        vt.out('\x06')

        return vt.attr(fore, '[', vt.yellow, vt.bright, back ? titlecase(title) : 'Iron Bank', vt.normal, fore, ']'
            , vt.faint, ' Option '
            , vt.normal, vt.cyan, '(Q=Quit): ')
    }

    export function emulator(cb: Function) {
        vt.action('list')
        vt.form = {
            'term': {
                cb: () => {
                    if (vt.entry && vt.entry.length == 2) vt.emulation = <EMULATION>vt.entry.toUpperCase()
                    $.player.emulation = vt.emulation
                    if (vt.tty == 'telnet') vt.outln(`@vt.title( ${$.player.emulation})`, -100)
                    vt.outln('\n', vt.reset, vt.magenta, vt.LGradient, vt.reverse, 'BANNER', vt.noreverse, vt.RGradient)
                    vt.outln(vt.red, 'R', vt.green, 'G', vt.blue, 'B', vt.reset, vt.bright, ' bold ', vt.normal, 'normal', vt.blink, ' flash ', vt.noblink, vt.faint, 'dim')
                    vt.out(vt.yellow, 'Cleric: ', vt.bright, { VT: '\x1B(0\x7D\x1B(B', PC: '\x9C', XT: '✟', dumb: '$' }[$.player.emulation]
                        , vt.normal, vt.magenta, '  Teleport: ', vt.bright, { VT: '\x1B(0\x67\x1B(B', PC: '\xF1', XT: '↨', dumb: '%' }[$.player.emulation])
                    $.online.altered = true
                    if ($.player.emulation == 'XT') {
                        vt.outln(vt.lblack, '  Bat: 🦇')
                        vt.sound('yahoo', 22)
                        cb()
                        return
                    }
                    vt.outln(-2200)
                    beep()
                    if (process.stdout.rows && process.stdout.rows !== $.player.rows)
                        $.player.rows = process.stdout.rows
                    for (let rows = $.player.rows + 5; rows > 1; rows--)
                        vt.out(bracket(rows >= 24 ? rows : '..'))
                    vt.form['rows'].prompt = vt.attr('Enter top visible row number ', vt.faint, '[', vt.reset, vt.bright, `${$.player.rows}`, vt.faint, vt.cyan, ']', vt.reset, ': ')
                    vt.focus = 'rows'
                }, prompt: vt.attr('Select ', vt.faint, '[', vt.reset, vt.bright, `${$.player.emulation}`, vt.faint, vt.cyan, ']', vt.reset, ': ')
                , enter: $.player.emulation, match: /VT|PC|XT/i, max: 2
            },
            'rows': {
                cb: () => {
                    const n = whole(vt.entry)
                    if (n > 23) $.player.rows = n
                    vt.outln()
                    vt.focus = 'pause'
                }, enter: $.player.rows.toString(), max: 2, match: /^[2-9][0-9]$/
            },
            'pause': { cb: cb, pause: true }
        }

        vt.outln('\n', vt.cyan, 'Which emulation / character encoding are you using?')
        vt.out(bracket('VT'), ' classic VT terminal with DEC drawing (telnet b&w)')
        vt.out(bracket('PC'), ' former ANSI color with Western IBM CP850 (telnet color)')
        vt.outln(bracket('XT'), ' modern ANSI color with UTF-8 & emojis (browser multimedia)')
        vt.focus = 'term'
    }

    export function getRing(how: string, what: string) {
        vt.outln()
        vt.out(vt.yellow, vt.bright, 'You ', how, an(what, false))
        vt.out(vt.cyan, what, vt.normal)
        if ($.player.emulation == 'XT') vt.out(' ', Ring.name[what].emoji, ' 💍')
        vt.out(' ring', vt.reset, ', which can\n'
            , vt.bright, vt.yellow, Ring.name[what].description)
        vt.profile({ jpg: `ring/${what}`, handle: `${what} ${Ring.name[what].emoji} 💍 ring`, effect: 'tada' })
    }

    export function input(focus: string | number, input = '', speed = 8) {
        if ($.access.bot) {
            const cr = (vt.form[focus].eol || vt.form[focus].lines)
            vt.typeahead += input
            if (cr || !input) vt.typeahead += '\r'
            vt.form[focus].delay = speed < 100 ? 125 * dice(speed) * dice(speed) : speed
        }
        vt.focus = focus
    }

    export function log(who: string, message: string) {
        const log = `${LOG}/${who}.txt`
        if (who.length && who[0] !== '_' && who !== $.player.id)
            fs.appendFileSync(log, `${message}\n`)
    }

    export function money(level: number): number {
        return int(Math.pow(2, (level - 1) / 2) * 10 * (101 - level) / 100)
    }

    export function news(message: string, commit = false) {

        const log = `${NEWS}/${$.player.id}.log`

        if ($.access.roleplay) {
            fs.appendFileSync(log, `${message}\n`)
            if (message && commit) {
                const paper = `${NEWS}/files/tavern/today.txt`
                fs.appendFileSync(paper, fs.readFileSync(log))
            }
        }
        if (commit)
            fs.unlink(log, () => { })
    }

    export function rings(profile = $.online) {
        for (let i in profile.user.rings) {
            let ring = profile.user.rings[i]
            vt.out(vt.cyan, $.player.emulation == 'XT' ? '⍤' : vt.Empty, ' ', vt.bright, ring, vt.normal, ' ')
            if ($.player.emulation == 'XT') vt.out(Ring.name[ring].emoji, '💍')
            vt.outln('ring:', vt.reset, ' can ', Ring.name[ring].description, -100)
        }
    }

    export function tradein(retail: number, percentage = $.online.cha): number {
        percentage--
        return whole(retail * percentage / 100)
    }

    export function weapon(profile = $.online, text = false): string {
        return text ? profile.user.weapon + buff(profile.user.toWC, profile.toWC, true)
            : vt.attr(profile.weapon.shoppe ? vt.white : profile.weapon.dwarf ? vt.yellow : vt.lcyan
                , profile.user.weapon, vt.white, buff(profile.user.toWC, profile.toWC))
    }

    //  non-negative integer
    export function whole(n: string | number) {
        let i = int(n)
        return (i < 0) ? 0 : i
    }

    class _xvt extends xvt {

        tty: TTY = 'telnet'

        cls() {
            const rows = process.stdout.rows
            const scroll = (this.row < rows ? vt.row : rows) - (this.col == 1 ? 2 : 1)
            this.out(this.off)
            this.plot(rows, 1)
            this.outln('\n'.repeat(scroll))
            this.out(this.clear, -10)  //  allow XTerm to flush
        }

        //  web client extended commands in terminal emulator
        action(menu: string) {
            if (this.tty == 'web') vt.out(`@action(${menu})`)
        }

        animated(effect: string, sync = 2) {
            if (this.tty == 'web') vt.out(`@animated(${effect})`, -10 * sync)
        }

        music(tune: string, sync = 2) {
            if (this.tty == 'web') vt.out(`@tune(${tune})`, -10 * sync)
        }

        profile(params) {
            if (this.tty == 'web') vt.out(`@profile(${JSON.stringify(params)})`)
        }

        sound(effect: string, sync = 2) {
            if (this.tty == 'web')
                vt.out(`@play(${effect})`, -100 * sync)
            else
                vt.beep()
        }

        title(name: string) {
            if (vt.emulation == 'XT') vt.out(`\x1B]2;${name}\x07`)
            if (this.tty == 'web') vt.out(`@title(${name})`)
        }

        wall(who: string, msg: string) {
            vt.out(`@wall(${who} ${msg})`)
        }
    }

    export const vt = new _xvt('VT', false)
}

export = sys
